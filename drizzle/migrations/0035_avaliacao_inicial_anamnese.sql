-- Avaliação inicial: paciente novo só agenda a 1ª consulta após o pagamento da avaliação
-- e o formulário de entrevista (anamnese) preenchido pela família.

create table public.avaliacoes_iniciais (
  paciente_id uuid primary key references public.pacientes(id) on delete restrict,
  clinica_id uuid not null default public.minha_clinica() references public.clinicas(id) on delete restrict,
  status text not null default 'aguardando_pagamento'
    check (status in ('aguardando_pagamento', 'aguardando_formulario', 'concluida', 'dispensada')),
  cobranca_id uuid references public.cobrancas(id) on delete restrict,
  pagamento_confirmado_em timestamptz,
  pagamento_origem text check (pagamento_origem in ('cobranca', 'manual')),
  pagamento_confirmado_por uuid,
  pagamento_observacao text check (char_length(pagamento_observacao) <= 500),
  formulario_liberado_em timestamptz,
  preenchido_em timestamptz,
  preenchido_por_nome text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index avaliacoes_iniciais_clinica_status_idx on public.avaliacoes_iniciais (clinica_id, status);
create index avaliacoes_iniciais_cobranca_idx on public.avaliacoes_iniciais (cobranca_id);
comment on table public.avaliacoes_iniciais is 'Etapa de avaliação inicial do paciente novo (pagamento + formulário da família). Escrita só por funções do banco e pelo servidor.';

grant select on public.avaliacoes_iniciais to authenticated;
grant all on public.avaliacoes_iniciais to service_role;
alter table public.avaliacoes_iniciais enable row level security;
create policy "equipe le avaliacao inicial" on public.avaliacoes_iniciais for select to authenticated
  using (clinica_id = (select public.minha_clinica()) and public.is_staff(auth.uid()) and public.pode_ver_paciente(paciente_id));

create table public.anamneses (
  paciente_id uuid primary key references public.avaliacoes_iniciais(paciente_id) on delete restrict,
  clinica_id uuid not null references public.clinicas(id) on delete restrict,
  versao integer not null check (versao > 0),
  respostas jsonb not null check (jsonb_typeof(respostas) = 'object' and pg_column_size(respostas) < 300000),
  preenchido_por uuid not null,
  preenchido_por_nome text not null check (char_length(preenchido_por_nome) between 3 and 150),
  preenchido_por_parentesco text not null check (char_length(preenchido_por_parentesco) between 2 and 40),
  preenchido_por_email text,
  lgpd_texto_hash text not null,
  ip text,
  user_agent text,
  comprovante_hash text not null,
  created_at timestamptz not null default now()
);
comment on table public.anamneses is 'Entrevista inicial (anamnese) enviada pela família. Imutável; leitura só de quem vê dados clínicos do paciente.';

grant select on public.anamneses to authenticated;
grant all on public.anamneses to service_role;
alter table public.anamneses enable row level security;
create policy "clinico le anamnese" on public.anamneses for select to authenticated
  using (clinica_id = (select public.minha_clinica()) and public.pode_ver_dados_clinicos(paciente_id));

create table public.anamnese_pareceres (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null default public.minha_clinica() references public.clinicas(id) on delete restrict,
  paciente_id uuid not null references public.anamneses(paciente_id) on delete restrict,
  especialidade_id uuid not null references public.especialidades(id) on delete restrict,
  profissional_id uuid not null default auth.uid(),
  profissional_nome text,
  profissional_registro text,
  encaminhamentos text not null check (char_length(trim(encaminhamentos)) between 1 and 5000),
  condutas text not null check (char_length(trim(condutas)) between 1 and 5000),
  created_at timestamptz not null default now()
);
create index anamnese_pareceres_paciente_idx on public.anamnese_pareceres (paciente_id);
comment on table public.anamnese_pareceres is 'Parte do profissional na entrevista inicial (encaminhamentos, condutas, assinatura). Somente inclusão.';

grant select, insert on public.anamnese_pareceres to authenticated;
grant all on public.anamnese_pareceres to service_role;
alter table public.anamnese_pareceres enable row level security;
create policy "clinico le parecer" on public.anamnese_pareceres for select to authenticated
  using (clinica_id = (select public.minha_clinica()) and public.pode_ver_dados_clinicos(paciente_id));
create policy "especialidade registra parecer" on public.anamnese_pareceres for insert to authenticated
  with check (clinica_id = (select public.minha_clinica())
    and public.has_especialidade(auth.uid(), especialidade_id)
    and public.pode_ver_dados_clinicos(paciente_id));

-- Mesma clínica em todas as referências
create or replace function public.avaliacao_mesma_clinica()
returns trigger language plpgsql security definer set search_path = public as $$
declare ok boolean := true;
begin
  if TG_TABLE_NAME = 'avaliacoes_iniciais' then
    ok := exists (select 1 from pacientes where id = new.paciente_id and clinica_id = new.clinica_id)
      and (new.cobranca_id is null or exists (
        select 1 from cobrancas where id = new.cobranca_id and clinica_id = new.clinica_id and paciente_id = new.paciente_id));
  elsif TG_TABLE_NAME = 'anamneses' then
    ok := exists (select 1 from avaliacoes_iniciais where paciente_id = new.paciente_id and clinica_id = new.clinica_id);
  elsif TG_TABLE_NAME = 'anamnese_pareceres' then
    ok := exists (select 1 from anamneses where paciente_id = new.paciente_id and clinica_id = new.clinica_id)
      and exists (select 1 from especialidades where id = new.especialidade_id and clinica_id = new.clinica_id);
  end if;
  if not ok then raise exception 'Registro de outra clínica não permitido' using errcode = '42501'; end if;
  return new;
end $$;

create trigger avaliacoes_iniciais_mesma_clinica before insert or update on public.avaliacoes_iniciais
  for each row execute function public.avaliacao_mesma_clinica();
create trigger anamneses_mesma_clinica before insert on public.anamneses
  for each row execute function public.avaliacao_mesma_clinica();
create trigger anamnese_pareceres_mesma_clinica before insert on public.anamnese_pareceres
  for each row execute function public.avaliacao_mesma_clinica();

create trigger trg_avaliacoes_iniciais_updated before update on public.avaliacoes_iniciais
  for each row execute function public.set_updated_at();

-- Anamnese e parecer não podem ser alterados nem apagados (registro clínico)
create or replace function public.anamnese_imutavel()
returns trigger language plpgsql set search_path = public as $$
begin
  raise exception 'A entrevista inicial e o parecer não podem ser alterados nem apagados.' using errcode = '42501';
end $$;
create trigger trg_anamneses_imutavel before update or delete on public.anamneses
  for each row execute function public.anamnese_imutavel();
create trigger trg_anamnese_pareceres_imutavel before update or delete on public.anamnese_pareceres
  for each row execute function public.anamnese_imutavel();

-- Parecer: autor, nome e registro gravados pelo banco
create or replace function public.parecer_assinatura()
returns trigger language plpgsql security definer set search_path = public as $$
declare pr record;
begin
  new.profissional_id := auth.uid();
  select nome, conselho, registro_profissional into pr from public.profiles where id = new.profissional_id;
  new.profissional_nome := pr.nome;
  new.profissional_registro := nullif(trim(coalesce(pr.conselho,'') || ' ' || coalesce(pr.registro_profissional,'')), '');
  new.created_at := now();
  return new;
end $$;
create trigger trg_anamnese_pareceres_assinatura before insert on public.anamnese_pareceres
  for each row execute function public.parecer_assinatura();

-- Auditoria
create trigger auditoria_avaliacoes_iniciais after insert or update or delete on public.avaliacoes_iniciais
  for each row execute function public.auditar_alteracao();
create trigger auditoria_anamneses after insert or update or delete on public.anamneses
  for each row execute function public.auditar_alteracao();
create trigger auditoria_anamnese_pareceres after insert or update or delete on public.anamnese_pareceres
  for each row execute function public.auditar_alteracao();

-- Anamnese e parecer são clínicos: na auditoria, só o master vê
drop policy "gestor le auditoria" on public.auditoria;
create policy "gestor le auditoria" on public.auditoria for select to authenticated
  using (clinica_id = (select public.minha_clinica())
    and (public.has_role(auth.uid(), 'master'::app_role)
      or (public.is_gestor(auth.uid()) and tabela <> all (array[
        'evolucoes', 'plano_metas', 'evolucao_metas', 'evolucao_adendos', 'paciente_dados_clinicos',
        'anamneses', 'anamnese_pareceres']))));

-- Paciente novo já nasce com a avaliação pendente (pacientes antigos não são afetados)
create or replace function public.criar_avaliacao_inicial()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.avaliacoes_iniciais (paciente_id, clinica_id) values (new.id, new.clinica_id)
  on conflict (paciente_id) do nothing;
  return new;
end $$;
create trigger trg_pacientes_avaliacao_inicial after insert on public.pacientes
  for each row execute function public.criar_avaliacao_inicial();

-- Bloqueio do agendamento enquanto a avaliação estiver pendente
create or replace function public.exigir_avaliacao_inicial()
returns trigger language plpgsql security definer set search_path = public as $$
declare st text;
begin
  select status into st from public.avaliacoes_iniciais where paciente_id = new.paciente_id;
  if st = 'aguardando_pagamento' then
    raise exception 'avaliacao_inicial_pendente: aguardando o pagamento da avaliação inicial' using errcode = 'P0001';
  elsif st = 'aguardando_formulario' then
    raise exception 'avaliacao_inicial_pendente: aguardando a família preencher o formulário de avaliação' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger trg_agendamentos_exige_avaliacao before insert or update of paciente_id on public.agendamentos
  for each row execute function public.exigir_avaliacao_inicial();

-- Pagamento da cobrança ligada libera o formulário; estorno volta a pendência
create or replace function public.avaliacao_pagamento_cobranca()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'pago' and old.status is distinct from 'pago' then
    update public.avaliacoes_iniciais
       set status = 'aguardando_formulario', pagamento_confirmado_em = coalesce(new.pago_em, now()),
           pagamento_origem = 'cobranca', formulario_liberado_em = now()
     where cobranca_id = new.id and status = 'aguardando_pagamento';
  elsif old.status = 'pago' and new.status <> 'pago' then
    update public.avaliacoes_iniciais
       set status = 'aguardando_pagamento', pagamento_confirmado_em = null, pagamento_origem = null, formulario_liberado_em = null
     where cobranca_id = new.id and status = 'aguardando_formulario' and pagamento_origem = 'cobranca';
  end if;
  return new;
end $$;
create trigger trg_cobrancas_avaliacao after update of status on public.cobrancas
  for each row execute function public.avaliacao_pagamento_cobranca();

-- Financeiro liga a cobrança gerada à avaliação
create or replace function public.vincular_cobranca_avaliacao(_paciente uuid, _cobranca uuid)
returns void language plpgsql security definer set search_path = public as $$
declare a record; atual text;
begin
  if not (public.is_gestor(auth.uid()) or public.has_role(auth.uid(), 'financeiro')) then
    raise exception 'Seu perfil não tem permissão para cobranças.' using errcode = '42501';
  end if;
  select * into a from public.avaliacoes_iniciais
   where paciente_id = _paciente and clinica_id = public.minha_clinica() for update;
  if not found then raise exception 'Este paciente não tem avaliação inicial pendente.'; end if;
  if a.status <> 'aguardando_pagamento' then raise exception 'O pagamento da avaliação já foi confirmado.'; end if;
  if a.cobranca_id is not null then
    select status into atual from public.cobrancas where id = a.cobranca_id;
    if atual in ('pendente', 'em_analise', 'pago', 'contestado') then
      raise exception 'Já existe uma cobrança da avaliação em aberto. Cancele-a antes de gerar outra.';
    end if;
  end if;
  if not exists (select 1 from public.cobrancas where id = _cobranca and paciente_id = _paciente and clinica_id = a.clinica_id) then
    raise exception 'Cobrança não encontrada.';
  end if;
  update public.avaliacoes_iniciais set cobranca_id = _cobranca where paciente_id = _paciente;
end $$;

-- Pagamento recebido por fora (dinheiro, Pix direto, máquina): gestão ou financeiro confirmam com justificativa
create or replace function public.confirmar_pagamento_avaliacao(_paciente uuid, _observacao text)
returns void language plpgsql security definer set search_path = public as $$
declare a record; obs text := trim(coalesce(_observacao, ''));
begin
  if not (public.is_gestor(auth.uid()) or public.has_role(auth.uid(), 'financeiro')) then
    raise exception 'Seu perfil não tem permissão para confirmar pagamentos.' using errcode = '42501';
  end if;
  if char_length(obs) < 5 or char_length(obs) > 500 then
    raise exception 'Descreva como o pagamento foi recebido (5 a 500 caracteres).';
  end if;
  select * into a from public.avaliacoes_iniciais
   where paciente_id = _paciente and clinica_id = public.minha_clinica() for update;
  if not found then raise exception 'Este paciente não tem avaliação inicial pendente.'; end if;
  if a.status <> 'aguardando_pagamento' then raise exception 'O pagamento da avaliação já foi confirmado.'; end if;
  update public.avaliacoes_iniciais
     set status = 'aguardando_formulario', pagamento_confirmado_em = now(), pagamento_origem = 'manual',
         pagamento_confirmado_por = auth.uid(), pagamento_observacao = obs, formulario_liberado_em = now()
   where paciente_id = _paciente;
end $$;

-- Área da família: situação da avaliação + dados da ficha para pré-preencher
create or replace function public.familia_avaliacao(_paciente uuid)
returns table(status text, formulario_liberado_em timestamptz, preenchido_em timestamptz, preenchido_por_nome text,
              clinica_nome text, ficha jsonb, respostas jsonb)
language sql stable security definer set search_path = public as $$
  select a.status, a.formulario_liberado_em, a.preenchido_em, a.preenchido_por_nome, c.nome,
    jsonb_build_object(
      'nome', p.nome, 'data_nascimento', p.data_nascimento, 'cpf', p.cpf,
      'endereco', p.endereco, 'numero', p.numero, 'complemento', p.complemento, 'cep', p.cep,
      'cidade', p.cidade, 'uf', p.uf, 'escola', p.escola, 'convenio', p.convenio,
      'responsavel_nome', p.responsavel_nome, 'responsavel_parentesco', p.responsavel_parentesco,
      'responsavel_telefone', p.responsavel_telefone, 'responsavel_email', p.responsavel_email,
      'responsavel2_nome', p.responsavel2_nome, 'responsavel2_parentesco', p.responsavel2_parentesco,
      'responsavel2_telefone', p.responsavel2_telefone, 'responsavel2_email', p.responsavel2_email,
      'responsavel_financeiro_nome', p.responsavel_financeiro_nome),
    an.respostas
  from public.avaliacoes_iniciais a
  join public.pacientes p on p.id = a.paciente_id
  join public.clinicas c on c.id = a.clinica_id
  left join public.anamneses an on an.paciente_id = a.paciente_id
  where public.responsavel_de(_paciente) and a.paciente_id = _paciente and a.status <> 'dispensada'
$$;

-- Gravação da anamnese (só o servidor, depois de conferir o responsável): grava e conclui numa transação
create or replace function public.registrar_anamnese(
  _paciente uuid, _versao integer, _respostas jsonb, _usuario uuid, _nome text, _parentesco text,
  _email text, _lgpd_hash text, _ip text, _user_agent text, _comprovante text)
returns timestamptz language plpgsql security definer set search_path = public as $$
declare a record; agora timestamptz := now();
begin
  select * into a from public.avaliacoes_iniciais where paciente_id = _paciente for update;
  if not found or a.status <> 'aguardando_formulario' then
    raise exception 'O formulário não está disponível para preenchimento.';
  end if;
  insert into public.anamneses (paciente_id, clinica_id, versao, respostas, preenchido_por, preenchido_por_nome,
    preenchido_por_parentesco, preenchido_por_email, lgpd_texto_hash, ip, user_agent, comprovante_hash, created_at)
  values (_paciente, a.clinica_id, _versao, _respostas, _usuario, _nome, _parentesco, _email, _lgpd_hash, _ip, _user_agent, _comprovante, agora);
  update public.avaliacoes_iniciais
     set status = 'concluida', preenchido_em = agora, preenchido_por_nome = _nome
   where paciente_id = _paciente;
  return agora;
end $$;

-- Nenhuma função acessível sem sessão
revoke execute on function public.avaliacao_mesma_clinica() from public, anon;
revoke execute on function public.anamnese_imutavel() from public, anon;
revoke execute on function public.parecer_assinatura() from public, anon;
revoke execute on function public.criar_avaliacao_inicial() from public, anon;
revoke execute on function public.exigir_avaliacao_inicial() from public, anon;
revoke execute on function public.avaliacao_pagamento_cobranca() from public, anon;
revoke execute on function public.vincular_cobranca_avaliacao(uuid, uuid) from public, anon;
revoke execute on function public.confirmar_pagamento_avaliacao(uuid, text) from public, anon;
revoke execute on function public.familia_avaliacao(uuid) from public, anon;
revoke execute on function public.registrar_anamnese(uuid, integer, jsonb, uuid, text, text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.avaliacao_mesma_clinica() to authenticated, service_role;
grant execute on function public.anamnese_imutavel() to authenticated, service_role;
grant execute on function public.parecer_assinatura() to authenticated, service_role;
grant execute on function public.criar_avaliacao_inicial() to authenticated, service_role;
grant execute on function public.exigir_avaliacao_inicial() to authenticated, service_role;
grant execute on function public.avaliacao_pagamento_cobranca() to authenticated, service_role;
grant execute on function public.vincular_cobranca_avaliacao(uuid, uuid) to authenticated, service_role;
grant execute on function public.confirmar_pagamento_avaliacao(uuid, text) to authenticated, service_role;
grant execute on function public.familia_avaliacao(uuid) to authenticated, service_role;
grant execute on function public.registrar_anamnese(uuid, integer, jsonb, uuid, text, text, text, text, text, text, text) to service_role;
