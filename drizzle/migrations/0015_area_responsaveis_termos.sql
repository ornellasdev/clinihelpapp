-- ===== Quem é responsável: e-mail da sessão (comprovado por código no e-mail) na ficha da criança =====
create or replace function public.familia_sessao_ok()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(exists (
    select 1 from jsonb_array_elements(coalesce(auth.jwt() -> 'amr', '[]'::jsonb)) a
    where a ->> 'method' in ('otp', 'magiclink', 'email')
  ), false)
$$;

create or replace function public.familia_email()
returns text language sql stable security definer set search_path = public as $$
  select lower(trim(email)) from auth.users where id = auth.uid()
$$;

create or replace function public.responsavel_de(_paciente uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.familia_sessao_ok() and exists (
    select 1 from public.pacientes p join public.clinicas c on c.id = p.clinica_id
    where p.id = _paciente and p.ativo and c.ativa
      and public.familia_email() in (lower(trim(p.responsavel_email)), lower(trim(p.responsavel2_email)), lower(trim(p.responsavel_financeiro_email)))
  )
$$;

create or replace function public.familia_agenda(_paciente uuid)
returns table (id uuid, inicio timestamptz, fim timestamptz, status text, especialidade text, cor text, profissional text, sala text)
language sql stable security definer set search_path = public as $$
  select a.id, a.inicio, a.fim, a.status::text, e.nome, e.cor, pr.nome, s.nome
  from public.agendamentos a
  join public.especialidades e on e.id = a.especialidade_id
  join public.profiles pr on pr.id = a.profissional_id
  join public.salas s on s.id = a.sala_id
  where public.responsavel_de(_paciente) and a.paciente_id = _paciente
    and a.inicio >= now() - interval '120 days' and a.status <> 'cancelado'
  order by a.inicio
$$;

create or replace function public.familia_cobrancas(_paciente uuid)
returns table (id uuid, descricao text, valor numeric, vencimento date, status text, forma text, token_publico text,
  pago_em timestamptz, valor_pago numeric, pagador_nome text, pagador_cpf text, clinica_nome text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select cb.id, cb.descricao, cb.valor, cb.vencimento, cb.status, cb.forma, cb.token_publico,
    cb.pago_em, cb.valor_pago, cb.pagador_nome, cb.pagador_cpf, c.nome, cb.created_at
  from public.cobrancas cb join public.clinicas c on c.id = cb.clinica_id
  where public.responsavel_de(_paciente) and cb.paciente_id = _paciente and cb.status <> 'cancelada'
  order by cb.vencimento desc
$$;

-- ===== Relatórios liberados aos responsáveis =====
create or replace function public.tem_especialidade(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profissional_especialidades where user_id = _user_id) and public.is_staff(_user_id)
$$;

create table public.relatorios_liberados (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null default public.minha_clinica() references public.clinicas(id) on delete cascade,
  paciente_id uuid not null references public.pacientes(id) on delete cascade,
  titulo text not null check (char_length(titulo) between 1 and 200),
  finalidade text check (char_length(finalidade) <= 60),
  periodo_de date not null,
  periodo_ate date not null,
  storage_path text not null,
  tamanho bigint,
  liberado_por uuid default auth.uid(),
  liberado_por_nome text,
  created_at timestamptz not null default now()
);
create index relatorios_liberados_pac_idx on public.relatorios_liberados (clinica_id, paciente_id, created_at desc);
grant select, insert, delete on public.relatorios_liberados to authenticated;
grant all on public.relatorios_liberados to service_role;
alter table public.relatorios_liberados enable row level security;
create policy "clinico le relatorios liberados" on public.relatorios_liberados for select to authenticated
  using (clinica_id = (select public.minha_clinica()) and (public.has_role(auth.uid(), 'master') or public.tem_especialidade(auth.uid())));
create policy "clinico libera relatorio" on public.relatorios_liberados for insert to authenticated
  with check (clinica_id = (select public.minha_clinica()) and (public.has_role(auth.uid(), 'master') or public.tem_especialidade(auth.uid()))
    and (storage.foldername(storage_path))[1] = clinica_id::text);
create policy "autor revoga relatorio" on public.relatorios_liberados for delete to authenticated
  using (clinica_id = (select public.minha_clinica()) and (public.has_role(auth.uid(), 'master') or liberado_por = auth.uid()));

create or replace function public.familia_relatorios(_paciente uuid)
returns table (id uuid, titulo text, finalidade text, periodo_de date, periodo_ate date, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select r.id, r.titulo, r.finalidade, r.periodo_de, r.periodo_ate, r.created_at
  from public.relatorios_liberados r
  where public.responsavel_de(_paciente) and r.paciente_id = _paciente
  order by r.created_at desc
$$;

-- ===== Termos e assinaturas =====
create table public.termos_modelos (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null default public.minha_clinica() references public.clinicas(id) on delete cascade,
  tipo text not null default 'outro' check (tipo in ('tratamento', 'imagem', 'outro')),
  titulo text not null check (char_length(titulo) between 1 and 150),
  texto text not null check (char_length(texto) between 1 and 20000),
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.termos_modelos to authenticated;
grant all on public.termos_modelos to service_role;
alter table public.termos_modelos enable row level security;
create policy "equipe le modelos de termo" on public.termos_modelos for select to authenticated
  using (clinica_id = (select public.minha_clinica()) and public.is_staff(auth.uid()));
create policy "gestor cria modelo de termo" on public.termos_modelos for insert to authenticated
  with check (clinica_id = (select public.minha_clinica()) and public.is_gestor(auth.uid()));
create policy "gestor edita modelo de termo" on public.termos_modelos for update to authenticated
  using (clinica_id = (select public.minha_clinica()) and public.is_gestor(auth.uid()))
  with check (clinica_id = (select public.minha_clinica()));
create policy "gestor remove modelo de termo" on public.termos_modelos for delete to authenticated
  using (clinica_id = (select public.minha_clinica()) and public.is_gestor(auth.uid()));
create trigger trg_termos_modelos_updated before update on public.termos_modelos
  for each row execute function public.set_updated_at();

create table public.termos_assinaturas (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null default public.minha_clinica() references public.clinicas(id) on delete cascade,
  paciente_id uuid not null references public.pacientes(id) on delete cascade,
  modelo_id uuid references public.termos_modelos(id) on delete set null,
  tipo text not null default 'outro' check (tipo in ('tratamento', 'imagem', 'outro')),
  titulo text not null check (char_length(titulo) between 1 and 150),
  texto text not null check (char_length(texto) between 1 and 20000),
  texto_hash text not null,
  status text not null default 'pendente' check (status in ('pendente', 'assinado', 'cancelado')),
  solicitado_por uuid default auth.uid(),
  solicitado_por_nome text,
  created_at timestamptz not null default now(),
  cancelado_em timestamptz,
  assinado_em timestamptz,
  assinante_user_id uuid,
  assinante_nome text,
  assinante_cpf text,
  assinante_email text,
  assinante_parentesco text,
  decisao text check (decisao in ('concordo', 'autorizo', 'nao_autorizo')),
  assinatura_imagem text check (char_length(assinatura_imagem) <= 300000),
  ip text,
  user_agent text,
  comprovante_hash text
);
create index termos_assinaturas_pac_idx on public.termos_assinaturas (clinica_id, paciente_id, created_at desc);
grant select, insert, update on public.termos_assinaturas to authenticated;
grant all on public.termos_assinaturas to service_role;
alter table public.termos_assinaturas enable row level security;
create policy "equipe le termos" on public.termos_assinaturas for select to authenticated
  using (clinica_id = (select public.minha_clinica()) and public.is_staff(auth.uid()));
create policy "recepcao solicita termo" on public.termos_assinaturas for insert to authenticated
  with check (clinica_id = (select public.minha_clinica()) and (public.is_gestor(auth.uid()) or public.has_role(auth.uid(), 'recepcao'))
    and status = 'pendente' and assinado_em is null and assinatura_imagem is null and assinante_user_id is null);
-- A equipe só pode cancelar um pedido pendente; a assinatura é gravada pelo servidor.
create policy "recepcao cancela termo" on public.termos_assinaturas for update to authenticated
  using (clinica_id = (select public.minha_clinica()) and status = 'pendente' and (public.is_gestor(auth.uid()) or public.has_role(auth.uid(), 'recepcao')))
  with check (clinica_id = (select public.minha_clinica()) and status = 'cancelado' and assinado_em is null and assinatura_imagem is null);

-- Texto do termo não muda depois de criado; assinado ou cancelado nunca muda.
create or replace function public.proteger_termo()
returns trigger language plpgsql set search_path = public as $$
begin
  if old.status in ('assinado', 'cancelado') then
    raise exception 'Termo já encerrado não pode ser alterado' using errcode = '42501';
  end if;
  if new.texto is distinct from old.texto or new.texto_hash is distinct from old.texto_hash
     or new.titulo is distinct from old.titulo or new.paciente_id is distinct from old.paciente_id then
    raise exception 'O texto do termo não pode ser alterado' using errcode = '42501';
  end if;
  if new.status = 'cancelado' then new.cancelado_em := now(); end if;
  return new;
end $$;
create trigger trg_proteger_termo before update on public.termos_assinaturas
  for each row execute function public.proteger_termo();

create or replace function public.familia_criancas()
returns table (id uuid, nome text, data_nascimento date, clinica_nome text, termos_pendentes bigint)
language sql stable security definer set search_path = public as $$
  select p.id, p.nome, p.data_nascimento, c.nome,
    (select count(*) from public.termos_assinaturas t where t.paciente_id = p.id and t.status = 'pendente')
  from public.pacientes p join public.clinicas c on c.id = p.clinica_id
  where public.familia_sessao_ok() and p.ativo and c.ativa
    and public.familia_email() in (lower(trim(p.responsavel_email)), lower(trim(p.responsavel2_email)), lower(trim(p.responsavel_financeiro_email)))
  order by p.nome
$$;

create or replace function public.familia_termos(_paciente uuid)
returns table (id uuid, tipo text, titulo text, texto text, status text, created_at timestamptz, assinado_em timestamptz,
  assinante_nome text, assinante_parentesco text, decisao text, clinica_nome text, paciente_nome text)
language sql stable security definer set search_path = public as $$
  select t.id, t.tipo, t.titulo, t.texto, t.status, t.created_at, t.assinado_em,
    t.assinante_nome, t.assinante_parentesco, t.decisao, c.nome, p.nome
  from public.termos_assinaturas t
  join public.clinicas c on c.id = t.clinica_id
  join public.pacientes p on p.id = t.paciente_id
  where public.responsavel_de(_paciente) and t.paciente_id = _paciente and t.status <> 'cancelado'
  order by (t.status = 'pendente') desc, t.created_at desc
$$;

revoke execute on function public.familia_criancas() from anon;
revoke execute on function public.familia_agenda(uuid) from anon;
revoke execute on function public.familia_cobrancas(uuid) from anon;
revoke execute on function public.familia_relatorios(uuid) from anon;
revoke execute on function public.familia_termos(uuid) from anon;
revoke execute on function public.responsavel_de(uuid) from anon;

-- ===== Mesma clínica e auditoria =====
create or replace function public.garantir_mesma_clinica()
 returns trigger language plpgsql security definer set search_path to 'public'
as $function$
declare ok boolean := true;
begin
  if TG_TABLE_NAME = 'agendamentos' then
    ok := exists (select 1 from pacientes where id = new.paciente_id and clinica_id = new.clinica_id)
      and exists (select 1 from salas where id = new.sala_id and clinica_id = new.clinica_id)
      and exists (select 1 from especialidades where id = new.especialidade_id and clinica_id = new.clinica_id)
      and exists (select 1 from profiles where id = new.profissional_id and clinica_id = new.clinica_id);
  elsif TG_TABLE_NAME = 'evolucoes' then
    ok := exists (select 1 from pacientes where id = new.paciente_id and clinica_id = new.clinica_id)
      and exists (select 1 from especialidades where id = new.especialidade_id and clinica_id = new.clinica_id)
      and (new.agendamento_id is null or exists (select 1 from agendamentos where id = new.agendamento_id and clinica_id = new.clinica_id));
  elsif TG_TABLE_NAME in ('paciente_documentos', 'relatorios_liberados') then
    ok := exists (select 1 from pacientes where id = new.paciente_id and clinica_id = new.clinica_id);
  elsif TG_TABLE_NAME = 'termos_assinaturas' then
    ok := exists (select 1 from pacientes where id = new.paciente_id and clinica_id = new.clinica_id)
      and (new.modelo_id is null or exists (select 1 from termos_modelos where id = new.modelo_id and clinica_id = new.clinica_id));
  elsif TG_TABLE_NAME = 'pacientes' then
    ok := new.convenio_id is null or exists (select 1 from convenios where id = new.convenio_id and clinica_id = new.clinica_id);
  elsif TG_TABLE_NAME = 'convenio_valores' then
    ok := exists (select 1 from convenios where id = new.convenio_id and clinica_id = new.clinica_id);
  elsif TG_TABLE_NAME in ('user_roles', 'profissional_config') then
    ok := exists (select 1 from profiles where id = new.user_id and clinica_id = new.clinica_id);
  elsif TG_TABLE_NAME = 'profissional_especialidades' then
    ok := exists (select 1 from profiles where id = new.user_id and clinica_id = new.clinica_id)
      and exists (select 1 from especialidades where id = new.especialidade_id and clinica_id = new.clinica_id);
  elsif TG_TABLE_NAME = 'cobrancas' then
    ok := exists (select 1 from pacientes where id = new.paciente_id and clinica_id = new.clinica_id);
  elsif TG_TABLE_NAME = 'cobranca_itens' then
    ok := exists (select 1 from cobrancas where id = new.cobranca_id and clinica_id = new.clinica_id)
      and exists (select 1 from agendamentos a join cobrancas c on c.id = new.cobranca_id
                  where a.id = new.agendamento_id and a.clinica_id = new.clinica_id and a.paciente_id = c.paciente_id);
  elsif TG_TABLE_NAME = 'lista_espera' then
    ok := exists (select 1 from pacientes where id = new.paciente_id and clinica_id = new.clinica_id)
      and exists (select 1 from especialidades where id = new.especialidade_id and clinica_id = new.clinica_id)
      and (new.profissional_id is null or exists (select 1 from profiles where id = new.profissional_id and clinica_id = new.clinica_id));
  elsif TG_TABLE_NAME = 'plano_metas' then
    ok := exists (select 1 from pacientes where id = new.paciente_id and clinica_id = new.clinica_id)
      and exists (select 1 from especialidades where id = new.especialidade_id and clinica_id = new.clinica_id);
  elsif TG_TABLE_NAME = 'evolucao_metas' then
    ok := exists (select 1 from evolucoes where id = new.evolucao_id and clinica_id = new.clinica_id
                    and paciente_id = new.paciente_id and especialidade_id = new.especialidade_id)
      and exists (select 1 from plano_metas where id = new.meta_id and clinica_id = new.clinica_id
                    and paciente_id = new.paciente_id and especialidade_id = new.especialidade_id);
  elsif TG_TABLE_NAME = 'modelos_evolucao' then
    ok := exists (select 1 from especialidades where id = new.especialidade_id and clinica_id = new.clinica_id);
  end if;
  if not ok then raise exception 'Registro de outra clínica não permitido' using errcode = '42501'; end if;
  return new;
end $function$;

create trigger relatorios_liberados_mesma_clinica before insert or update on public.relatorios_liberados
  for each row execute function public.garantir_mesma_clinica();
create trigger termos_assinaturas_mesma_clinica before insert or update on public.termos_assinaturas
  for each row execute function public.garantir_mesma_clinica();
create trigger auditoria_relatorios_liberados after insert or update or delete on public.relatorios_liberados
  for each row execute function public.auditar_alteracao();
create trigger auditoria_termos_modelos after insert or update or delete on public.termos_modelos
  for each row execute function public.auditar_alteracao();
create trigger auditoria_termos_assinaturas after insert or update or delete on public.termos_assinaturas
  for each row execute function public.auditar_alteracao();

-- ===== Arquivos dos relatórios liberados (pasta da clínica) =====
create policy "clinico envia relatorio liberado" on storage.objects for insert to authenticated
  with check (bucket_id = 'relatorios-familia' and (storage.foldername(name))[1] = (select public.minha_clinica())::text
    and (public.has_role(auth.uid(), 'master') or public.tem_especialidade(auth.uid())));
create policy "clinico le relatorio liberado" on storage.objects for select to authenticated
  using (bucket_id = 'relatorios-familia' and (storage.foldername(name))[1] = (select public.minha_clinica())::text
    and (public.has_role(auth.uid(), 'master') or public.tem_especialidade(auth.uid())));
create policy "clinico remove relatorio liberado" on storage.objects for delete to authenticated
  using (bucket_id = 'relatorios-familia' and (storage.foldername(name))[1] = (select public.minha_clinica())::text
    and (public.has_role(auth.uid(), 'master') or owner = auth.uid()));