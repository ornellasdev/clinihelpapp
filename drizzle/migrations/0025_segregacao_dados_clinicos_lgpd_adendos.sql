-- =====================================================================
-- Etapa 1 · Pilares 1.2, 4.3 e 5.1 — Dados clínicos separados, LGPD e adendos
-- =====================================================================

-- 0) Funções de acesso (usadas pelas regras abaixo e na migração de papéis)
create or replace function public.ve_cadastro_completo(_uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_gestor(_uid) or public.has_role(_uid, 'recepcao') or public.has_role(_uid, 'financeiro')
$$;

-- Gestão, recepção e financeiro veem todos os pacientes; o terapeuta vê apenas os "seus":
-- com sessão marcada com ele, ou com prontuário/plano/lista de espera na especialidade dele.
create or replace function public.pode_ver_paciente(_paciente uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.ve_cadastro_completo(auth.uid())
    or (public.is_staff(auth.uid()) and (
         exists (select 1 from public.agendamentos a where a.paciente_id = _paciente and a.profissional_id = auth.uid())
      or exists (select 1 from public.evolucoes e where e.paciente_id = _paciente and public.has_especialidade(auth.uid(), e.especialidade_id))
      or exists (select 1 from public.plano_metas m where m.paciente_id = _paciente and public.has_especialidade(auth.uid(), m.especialidade_id))
      or exists (select 1 from public.lista_espera l where l.paciente_id = _paciente
                   and (l.profissional_id = auth.uid() or public.has_especialidade(auth.uid(), l.especialidade_id)))
    ))
$$;

-- Dados clínicos (diagnóstico, CID, alergias, medicação): master ou terapeuta do paciente.
create or replace function public.pode_ver_dados_clinicos(_paciente uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_role(auth.uid(), 'master')
    or (public.tem_especialidade(auth.uid()) and public.pode_ver_paciente(_paciente))
$$;

create or replace function public.documento_clinico(_categoria text)
returns boolean language sql immutable set search_path = public as $$
  select _categoria in ('Laudo', 'Relatório', 'Exame', 'Receita')
$$;

create or replace function public.pode_ver_documento(_categoria text, _paciente uuid, _enviado_por uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select _enviado_por = auth.uid()
    or case when public.documento_clinico(_categoria) then public.pode_ver_dados_clinicos(_paciente)
            else public.pode_ver_paciente(_paciente) end
$$;

create or replace function public.pode_ler_arquivo_documento(_path text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.paciente_documentos d
    where d.storage_path = _path and d.clinica_id = public.minha_clinica() and d.excluido_em is null
      and public.pode_ver_documento(d.categoria, d.paciente_id, d.enviado_por))
$$;

-- 1) Dados clínicos do paciente em tabela própria (ePHI separado do cadastro administrativo)
create table public.paciente_dados_clinicos (
  paciente_id uuid primary key references public.pacientes(id) on delete restrict,
  clinica_id uuid not null default public.minha_clinica() references public.clinicas(id) on delete restrict,
  diagnostico text check (char_length(diagnostico) <= 10000),
  cid text check (char_length(cid) <= 200),
  alergias text check (char_length(alergias) <= 5000),
  medicamentos text check (char_length(medicamentos) <= 5000),
  criado_por uuid default auth.uid(),
  atualizado_por uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.paciente_dados_clinicos to authenticated;
grant all on public.paciente_dados_clinicos to service_role;
alter table public.paciente_dados_clinicos enable row level security;

create policy "terapeuta le dados clinicos" on public.paciente_dados_clinicos for select to authenticated
  using (clinica_id = (select public.minha_clinica()) and public.pode_ver_dados_clinicos(paciente_id));
create policy "terapeuta registra dados clinicos" on public.paciente_dados_clinicos for insert to authenticated
  with check (clinica_id = (select public.minha_clinica()) and public.pode_ver_dados_clinicos(paciente_id));
create policy "terapeuta edita dados clinicos" on public.paciente_dados_clinicos for update to authenticated
  using (clinica_id = (select public.minha_clinica()) and public.pode_ver_dados_clinicos(paciente_id))
  with check (clinica_id = (select public.minha_clinica()) and public.pode_ver_dados_clinicos(paciente_id));

create or replace function public.dados_clinicos_carimbo()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.clinica_id := (select clinica_id from public.pacientes where id = new.paciente_id);
  if tg_op = 'UPDATE' then
    new.paciente_id := old.paciente_id;
    new.criado_por := old.criado_por;
    new.created_at := old.created_at;
    new.updated_at := now();
  end if;
  new.atualizado_por := coalesce(auth.uid(), new.atualizado_por);
  return new;
end $$;
create trigger trg_dados_clinicos_carimbo before insert or update on public.paciente_dados_clinicos
  for each row execute function public.dados_clinicos_carimbo();

-- Ponte de transição: enquanto a ficha ainda grava esses campos no cadastro, eles são copiados para cá.
create or replace function public.copiar_dados_clinicos_paciente()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' and coalesce(new.diagnostico, new.cid, new.alergias, new.medicamentos) is null then
    return null;
  end if;
  insert into public.paciente_dados_clinicos (paciente_id, clinica_id, diagnostico, cid, alergias, medicamentos)
  values (new.id, new.clinica_id, new.diagnostico, new.cid, new.alergias, new.medicamentos)
  on conflict (paciente_id) do update set
    diagnostico = excluded.diagnostico, cid = excluded.cid,
    alergias = excluded.alergias, medicamentos = excluded.medicamentos;
  return null;
end $$;
create trigger trg_pacientes_copia_dados_clinicos
  after insert or update of diagnostico, cid, alergias, medicamentos on public.pacientes
  for each row execute function public.copiar_dados_clinicos_paciente();

insert into public.paciente_dados_clinicos (paciente_id, clinica_id, diagnostico, cid, alergias, medicamentos)
select id, clinica_id, diagnostico, cid, alergias, medicamentos from public.pacientes
where coalesce(diagnostico, cid, alergias, medicamentos) is not null
on conflict (paciente_id) do nothing;

comment on column public.pacientes.diagnostico is 'TRANSIÇÃO: dado clínico migrando para paciente_dados_clinicos (copiado por trigger).';
comment on column public.pacientes.cid is 'TRANSIÇÃO: dado clínico migrando para paciente_dados_clinicos (copiado por trigger).';
comment on column public.pacientes.alergias is 'TRANSIÇÃO: dado clínico migrando para paciente_dados_clinicos (copiado por trigger).';
comment on column public.pacientes.medicamentos is 'TRANSIÇÃO: dado clínico migrando para paciente_dados_clinicos (copiado por trigger).';

-- 2) Consentimento LGPD (Art. 11 e 14) no cadastro do paciente
alter table public.pacientes
  add column if not exists lgpd_consentimento_status text not null default 'pendente',
  add column if not exists lgpd_consentimento_em timestamptz,
  add column if not exists lgpd_consentimento_termo_id uuid references public.termos_assinaturas(id) on delete restrict,
  add column if not exists lgpd_consentimento_documento_id uuid references public.paciente_documentos(id) on delete restrict,
  add column if not exists lgpd_consentimento_cpf text;
alter table public.pacientes add constraint pacientes_lgpd_status_check
  check (lgpd_consentimento_status in ('pendente', 'assinado', 'revogado'));
alter table public.pacientes add constraint pacientes_lgpd_comprovante_check
  check (lgpd_consentimento_status <> 'assinado'
         or lgpd_consentimento_termo_id is not null or lgpd_consentimento_documento_id is not null);
create index if not exists pacientes_lgpd_idx on public.pacientes (clinica_id, lgpd_consentimento_status);

create or replace function public.paciente_lgpd_carimbo()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'INSERT' or new.lgpd_consentimento_status is distinct from old.lgpd_consentimento_status then
    new.lgpd_consentimento_em := case new.lgpd_consentimento_status
      when 'pendente' then null
      else coalesce(case when tg_op = 'UPDATE' and new.lgpd_consentimento_em is distinct from old.lgpd_consentimento_em
                         then new.lgpd_consentimento_em end, now()) end;
  end if;
  return new;
end $$;
create trigger trg_pacientes_lgpd before insert or update on public.pacientes
  for each row execute function public.paciente_lgpd_carimbo();

-- Termo de consentimento de tratamento assinado pela família => consentimento LGPD registrado
create or replace function public.termo_atualiza_lgpd()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'assinado' and old.status is distinct from 'assinado'
     and new.tipo = 'tratamento' and new.decisao = 'concordo' then
    update public.pacientes set
      lgpd_consentimento_status = 'assinado',
      lgpd_consentimento_em = coalesce(new.assinado_em, now()),
      lgpd_consentimento_termo_id = new.id,
      lgpd_consentimento_cpf = new.assinante_cpf
    where id = new.paciente_id;
  end if;
  return null;
end $$;
create trigger trg_termo_atualiza_lgpd after update of status on public.termos_assinaturas
  for each row execute function public.termo_atualiza_lgpd();

update public.pacientes p set
  lgpd_consentimento_status = 'assinado', lgpd_consentimento_em = t.assinado_em,
  lgpd_consentimento_termo_id = t.id, lgpd_consentimento_cpf = t.assinante_cpf
from (select distinct on (paciente_id) * from public.termos_assinaturas
      where status = 'assinado' and tipo = 'tratamento' and decisao = 'concordo'
      order by paciente_id, assinado_em desc) t
where t.paciente_id = p.id and p.lgpd_consentimento_status = 'pendente';

-- 3) Adendos/errata de evolução: só inclusão, nunca alteração nem exclusão
create table public.evolucao_adendos (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null default public.minha_clinica() references public.clinicas(id) on delete restrict,
  evolucao_id uuid not null references public.evolucoes(id) on delete restrict,
  paciente_id uuid not null references public.pacientes(id) on delete restrict,
  especialidade_id uuid not null references public.especialidades(id) on delete restrict,
  profissional_id uuid not null default auth.uid(),
  profissional_nome text,
  profissional_registro text,
  motivo text check (char_length(motivo) <= 300),
  conteudo text not null check (char_length(btrim(conteudo)) between 1 and 20000),
  created_at timestamptz not null default now()
);
grant select, insert on public.evolucao_adendos to authenticated;
grant all on public.evolucao_adendos to service_role;
alter table public.evolucao_adendos enable row level security;

create policy "le adendos da especialidade" on public.evolucao_adendos for select to authenticated
  using (clinica_id = (select public.minha_clinica()) and public.can_view_especialidade(auth.uid(), especialidade_id));
create policy "profissional registra adendo" on public.evolucao_adendos for insert to authenticated
  with check (clinica_id = (select public.minha_clinica()) and public.has_especialidade(auth.uid(), especialidade_id)
              and profissional_id = auth.uid());
create index evolucao_adendos_evolucao_idx on public.evolucao_adendos (evolucao_id, created_at);
create index evolucao_adendos_paciente_idx on public.evolucao_adendos (paciente_id);

create or replace function public.adendo_assinatura()
returns trigger language plpgsql security definer set search_path = public as $$
declare ev record; pr record;
begin
  select clinica_id, paciente_id, especialidade_id into ev from public.evolucoes where id = new.evolucao_id;
  if not found then raise exception 'Evolução não encontrada.'; end if;
  new.clinica_id := ev.clinica_id;
  new.paciente_id := ev.paciente_id;
  new.especialidade_id := ev.especialidade_id;
  new.profissional_id := auth.uid();
  new.created_at := now();
  select nome, conselho, registro_profissional into pr from public.profiles where id = new.profissional_id;
  new.profissional_nome := coalesce(pr.nome, public.nome_auditoria());
  new.profissional_registro := nullif(trim(coalesce(pr.conselho, '') || ' ' || coalesce(pr.registro_profissional, '')), '');
  return new;
end $$;
create trigger trg_adendo_assinatura before insert on public.evolucao_adendos
  for each row execute function public.adendo_assinatura();

create or replace function public.bloquear_alteracao_adendo()
returns trigger language plpgsql set search_path = public as $$
begin
  raise exception 'Adendos do prontuário não podem ser alterados nem apagados.' using errcode = '42501';
end $$;
create trigger trg_adendo_imutavel before update or delete on public.evolucao_adendos
  for each row execute function public.bloquear_alteracao_adendo();
