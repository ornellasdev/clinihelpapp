-- Guias de convênio: autorização das sessões pela operadora (controle interno; a presença é validada no app da operadora).
create table public.guias_convenio (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null default public.minha_clinica() references public.clinicas(id) on delete cascade,
  paciente_id uuid not null references public.pacientes(id) on delete cascade,
  convenio_id uuid not null references public.convenios(id),
  especialidade_id uuid not null references public.especialidades(id),
  codigo_tuss text not null check (char_length(btrim(codigo_tuss)) between 1 and 40),
  codigo_guia text not null check (char_length(btrim(codigo_guia)) between 1 and 60),
  codigo_faturamento text not null check (char_length(btrim(codigo_faturamento)) between 1 and 60),
  sessoes_solicitadas integer not null check (sessoes_solicitadas between 1 and 999),
  sessoes_autorizadas integer check (sessoes_autorizadas between 0 and 999),
  data_solicitacao date not null default current_date,
  data_liberacao date,
  validade date,
  status text not null default 'solicitada' check (status in ('solicitada', 'autorizada', 'negada', 'faturada', 'cancelada')),
  anexo_path text,
  anexo_nome text check (char_length(anexo_nome) <= 200),
  anexo_mime text,
  observacoes text check (char_length(observacoes) <= 1000),
  criado_por uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint guia_autorizada_completa check (
    status not in ('autorizada', 'faturada') or (sessoes_autorizadas is not null and data_liberacao is not null and validade is not null)),
  constraint guia_datas_coerentes check (validade is null or data_liberacao is null or validade >= data_liberacao)
);
create index guias_convenio_busca_idx on public.guias_convenio (clinica_id, paciente_id, especialidade_id, status, validade);
grant select, insert, update, delete on public.guias_convenio to authenticated;
grant all on public.guias_convenio to service_role;
alter table public.guias_convenio enable row level security;

create policy "equipe de guias le guias" on public.guias_convenio for select to authenticated
  using (clinica_id = (select public.minha_clinica()) and (public.is_gestor(auth.uid()) or public.has_role(auth.uid(), 'recepcao') or public.has_role(auth.uid(), 'financeiro')));
create policy "equipe de guias cria guias" on public.guias_convenio for insert to authenticated
  with check (clinica_id = (select public.minha_clinica()) and (public.is_gestor(auth.uid()) or public.has_role(auth.uid(), 'recepcao') or public.has_role(auth.uid(), 'financeiro')));
create policy "equipe de guias edita guias" on public.guias_convenio for update to authenticated
  using (clinica_id = (select public.minha_clinica()) and (public.is_gestor(auth.uid()) or public.has_role(auth.uid(), 'recepcao') or public.has_role(auth.uid(), 'financeiro')))
  with check (clinica_id = (select public.minha_clinica()));
create policy "recepcao remove guias" on public.guias_convenio for delete to authenticated
  using (clinica_id = (select public.minha_clinica()) and (public.is_gestor(auth.uid()) or public.has_role(auth.uid(), 'recepcao')));

create trigger trg_guias_convenio_updated before update on public.guias_convenio
  for each row execute function public.set_updated_at();

-- Liberação diária de cada sessão (token/senha do dia) e vínculo com a guia que ela consome.
create table public.liberacoes_atendimento (
  agendamento_id uuid primary key references public.agendamentos(id) on delete cascade,
  clinica_id uuid not null default public.minha_clinica() references public.clinicas(id) on delete cascade,
  guia_id uuid references public.guias_convenio(id) on delete set null,
  status text not null default 'pendente' check (status in ('pendente', 'aguardando', 'liberado')),
  token text check (char_length(token) <= 80),
  liberado_por uuid,
  liberado_por_nome text,
  liberado_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index liberacoes_atendimento_guia_idx on public.liberacoes_atendimento (guia_id);
grant select, insert, update, delete on public.liberacoes_atendimento to authenticated;
grant all on public.liberacoes_atendimento to service_role;
alter table public.liberacoes_atendimento enable row level security;

create policy "equipe de guias le liberacoes" on public.liberacoes_atendimento for select to authenticated
  using (clinica_id = (select public.minha_clinica()) and (public.is_gestor(auth.uid()) or public.has_role(auth.uid(), 'recepcao') or public.has_role(auth.uid(), 'financeiro')));
create policy "recepcao cria liberacoes" on public.liberacoes_atendimento for insert to authenticated
  with check (clinica_id = (select public.minha_clinica()) and (public.is_gestor(auth.uid()) or public.has_role(auth.uid(), 'recepcao')));
create policy "recepcao edita liberacoes" on public.liberacoes_atendimento for update to authenticated
  using (clinica_id = (select public.minha_clinica()) and (public.is_gestor(auth.uid()) or public.has_role(auth.uid(), 'recepcao')))
  with check (clinica_id = (select public.minha_clinica()));
create policy "recepcao remove liberacoes" on public.liberacoes_atendimento for delete to authenticated
  using (clinica_id = (select public.minha_clinica()) and (public.is_gestor(auth.uid()) or public.has_role(auth.uid(), 'recepcao')));

create trigger trg_liberacoes_updated before update on public.liberacoes_atendimento
  for each row execute function public.set_updated_at();

-- Quem marcou "Liberado" e quando: preenchido pelo banco, não pelo navegador.
create or replace function public.liberacao_carimbo()
 returns trigger language plpgsql security definer set search_path to 'public'
as $$
begin
  if new.status = 'liberado' and (TG_OP = 'INSERT' or old.status is distinct from 'liberado') then
    new.liberado_em := now();
    new.liberado_por := auth.uid();
    new.liberado_por_nome := public.nome_auditoria();
  elsif new.status <> 'liberado' then
    new.liberado_em := null; new.liberado_por := null; new.liberado_por_nome := null;
  elsif TG_OP = 'UPDATE' then
    new.liberado_em := old.liberado_em; new.liberado_por := old.liberado_por; new.liberado_por_nome := old.liberado_por_nome;
  end if;
  return new;
end $$;
create trigger trg_liberacao_carimbo before insert or update on public.liberacoes_atendimento
  for each row execute function public.liberacao_carimbo();

-- Sessões consumidas por guia: confirmadas ou realizadas descontam do saldo; agendadas ficam reservadas.
create view public.guias_uso with (security_invoker = true) as
  select l.guia_id,
    count(*) filter (where a.status in ('confirmado', 'realizado'))::int as usadas,
    count(*) filter (where a.status = 'agendado')::int as reservadas
  from public.liberacoes_atendimento l
  join public.agendamentos a on a.id = l.agendamento_id
  where l.guia_id is not null
  group by l.guia_id;
grant select on public.guias_uso to authenticated;
grant select on public.guias_uso to service_role;

-- Baixa automática: ao confirmar/realizar a sessão sem guia vinculada, vincula a guia ativa
-- (autorizada, válida na data, com saldo; a que vence primeiro). Mesma regra de guiaParaSessao em src/lib/guias.ts.
create or replace function public.vincular_guia_sessao()
 returns trigger language plpgsql security definer set search_path to 'public'
as $$
declare v_guia uuid; v_dia date;
begin
  if new.status not in ('confirmado', 'realizado') then return new; end if;
  if exists (select 1 from liberacoes_atendimento where agendamento_id = new.id and guia_id is not null) then return new; end if;
  v_dia := (new.inicio at time zone 'America/Sao_Paulo')::date;
  select g.id into v_guia from guias_convenio g
  where g.clinica_id = new.clinica_id and g.paciente_id = new.paciente_id and g.especialidade_id = new.especialidade_id
    and g.status = 'autorizada' and g.validade >= v_dia
    and g.sessoes_autorizadas > (
      select count(*) from liberacoes_atendimento l join agendamentos a on a.id = l.agendamento_id
      where l.guia_id = g.id and a.status in ('confirmado', 'realizado') and a.id <> new.id)
  order by g.validade, g.created_at
  limit 1;
  if v_guia is null then return new; end if;
  insert into liberacoes_atendimento (agendamento_id, clinica_id, guia_id) values (new.id, new.clinica_id, v_guia)
  on conflict (agendamento_id) do update set guia_id = excluded.guia_id;
  return new;
end $$;
create trigger trg_agendamento_vincula_guia after insert or update of status on public.agendamentos
  for each row execute function public.vincular_guia_sessao();

-- Glosas: valores que a operadora não pagou (só gestão e financeiro, por envolver dinheiro).
create table public.glosas (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null default public.minha_clinica() references public.clinicas(id) on delete cascade,
  paciente_id uuid not null references public.pacientes(id) on delete cascade,
  convenio_id uuid not null references public.convenios(id),
  guia_id uuid references public.guias_convenio(id) on delete set null,
  agendamento_id uuid references public.agendamentos(id) on delete set null,
  valor numeric(12,2) not null check (valor > 0),
  motivo text not null check (motivo in ('token', 'guia_vencida', 'tuss', 'limite', 'sem_autorizacao', 'documentacao', 'outro')),
  motivo_detalhe text check (char_length(motivo_detalhe) <= 500),
  status text not null default 'identificada' check (status in ('identificada', 'em_recurso', 'recuperada', 'perda')),
  data_glosa date not null default current_date,
  resolvido_em date,
  criado_por uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index glosas_clinica_idx on public.glosas (clinica_id, status, convenio_id, data_glosa);
grant select, insert, update, delete on public.glosas to authenticated;
grant all on public.glosas to service_role;
alter table public.glosas enable row level security;

create policy "financeiro le glosas" on public.glosas for select to authenticated
  using (clinica_id = (select public.minha_clinica()) and (public.is_gestor(auth.uid()) or public.has_role(auth.uid(), 'financeiro')));
create policy "financeiro cria glosas" on public.glosas for insert to authenticated
  with check (clinica_id = (select public.minha_clinica()) and (public.is_gestor(auth.uid()) or public.has_role(auth.uid(), 'financeiro')));
create policy "financeiro edita glosas" on public.glosas for update to authenticated
  using (clinica_id = (select public.minha_clinica()) and (public.is_gestor(auth.uid()) or public.has_role(auth.uid(), 'financeiro')))
  with check (clinica_id = (select public.minha_clinica()));
create policy "financeiro remove glosas" on public.glosas for delete to authenticated
  using (clinica_id = (select public.minha_clinica()) and (public.is_gestor(auth.uid()) or public.has_role(auth.uid(), 'financeiro')));

create trigger trg_glosas_updated before update on public.glosas
  for each row execute function public.set_updated_at();

-- Referências sempre da mesma clínica (e do mesmo paciente).
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
  elsif TG_TABLE_NAME = 'guias_convenio' then
    ok := exists (select 1 from pacientes where id = new.paciente_id and clinica_id = new.clinica_id)
      and exists (select 1 from convenios where id = new.convenio_id and clinica_id = new.clinica_id)
      and exists (select 1 from especialidades where id = new.especialidade_id and clinica_id = new.clinica_id);
  elsif TG_TABLE_NAME = 'liberacoes_atendimento' then
    ok := exists (select 1 from agendamentos where id = new.agendamento_id and clinica_id = new.clinica_id)
      and (new.guia_id is null or exists (
        select 1 from guias_convenio g join agendamentos a on a.id = new.agendamento_id
        where g.id = new.guia_id and g.clinica_id = new.clinica_id and g.paciente_id = a.paciente_id));
  elsif TG_TABLE_NAME = 'glosas' then
    ok := exists (select 1 from pacientes where id = new.paciente_id and clinica_id = new.clinica_id)
      and exists (select 1 from convenios where id = new.convenio_id and clinica_id = new.clinica_id)
      and (new.guia_id is null or exists (select 1 from guias_convenio where id = new.guia_id and clinica_id = new.clinica_id and paciente_id = new.paciente_id))
      and (new.agendamento_id is null or exists (select 1 from agendamentos where id = new.agendamento_id and clinica_id = new.clinica_id and paciente_id = new.paciente_id));
  end if;
  if not ok then raise exception 'Registro de outra clínica não permitido' using errcode = '42501'; end if;
  return new;
end $function$;

create trigger guias_convenio_mesma_clinica before insert or update on public.guias_convenio
  for each row execute function public.garantir_mesma_clinica();
create trigger liberacoes_mesma_clinica before insert or update on public.liberacoes_atendimento
  for each row execute function public.garantir_mesma_clinica();
create trigger glosas_mesma_clinica before insert or update on public.glosas
  for each row execute function public.garantir_mesma_clinica();

-- Auditoria com descrição legível para as novas áreas.
create or replace function public.auditar_alteracao()
 returns trigger language plpgsql security definer set search_path to 'public'
as $function$
declare
  uid uuid := auth.uid();
  v_old jsonb; v_new jsonb; rec jsonb;
  k text; v_campos text[]; v_antes jsonb := '{}'; v_depois jsonb := '{}';
  v_desc text; v_pac text;
  v_acao text := case TG_OP when 'INSERT' then 'criou' when 'UPDATE' then 'alterou' else 'removeu' end;
begin
  if uid is null then return coalesce(new, old); end if;
  if TG_TABLE_NAME = 'atendimento_financeiro' and TG_OP = 'INSERT' then return new; end if;

  if TG_OP <> 'INSERT' then v_old := to_jsonb(old); end if;
  if TG_OP <> 'DELETE' then v_new := to_jsonb(new); end if;
  rec := coalesce(v_new, v_old);

  if TG_OP = 'UPDATE' then
    for k in select jsonb_object_keys(v_new) loop
      continue when k in ('updated_at', 'created_at');
      if (v_new -> k) is distinct from (v_old -> k) then
        v_campos := array_append(v_campos, k);
        v_antes := v_antes || jsonb_build_object(k, v_old -> k);
        v_depois := v_depois || jsonb_build_object(k, v_new -> k);
      end if;
    end loop;
    if v_campos is null then return new; end if;
  elsif TG_OP = 'INSERT' then
    v_depois := v_new - 'created_at' - 'updated_at' - 'clinica_id';
    v_antes := null;
  else
    v_antes := v_old - 'created_at' - 'updated_at' - 'clinica_id';
    v_depois := null;
  end if;

  if rec ? 'paciente_id' then
    select nome into v_pac from public.pacientes where id = (rec ->> 'paciente_id')::uuid;
  end if;

  v_desc := case TG_TABLE_NAME
    when 'agendamentos' then concat_ws(' · ', v_pac, to_char((rec ->> 'inicio')::timestamptz at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI'))
    when 'evolucoes' then concat_ws(' · ', v_pac, (select nome from public.especialidades where id = (rec ->> 'especialidade_id')::uuid), to_char((rec ->> 'data_atendimento')::date, 'DD/MM/YYYY'))
    when 'paciente_documentos' then concat_ws(' · ', rec ->> 'nome', v_pac)
    when 'atendimento_financeiro' then (
      select concat_ws(' · ', p.nome, to_char(a.inicio at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI'))
      from public.agendamentos a join public.pacientes p on p.id = a.paciente_id
      where a.id = (rec ->> 'agendamento_id')::uuid)
    when 'liberacoes_atendimento' then (
      select concat_ws(' · ', p.nome, to_char(a.inicio at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI'))
      from public.agendamentos a join public.pacientes p on p.id = a.paciente_id
      where a.id = (rec ->> 'agendamento_id')::uuid)
    when 'guias_convenio' then concat_ws(' · ', v_pac, 'Guia ' || (rec ->> 'codigo_guia'))
    when 'glosas' then concat_ws(' · ', v_pac, (select nome from public.convenios where id = (rec ->> 'convenio_id')::uuid))
    when 'user_roles' then concat_ws(' · ', (select nome from public.profiles where id = (rec ->> 'user_id')::uuid), rec ->> 'role')
    when 'profissional_especialidades' then concat_ws(' · ',
      (select nome from public.profiles where id = (rec ->> 'user_id')::uuid),
      (select nome from public.especialidades where id = (rec ->> 'especialidade_id')::uuid))
    when 'profissional_config' then (select nome from public.profiles where id = (rec ->> 'user_id')::uuid)
    when 'convenio_valores' then (select nome from public.convenios where id = (rec ->> 'convenio_id')::uuid)
    else coalesce(rec ->> 'nome', v_pac)
  end;

  insert into public.auditoria (clinica_id, usuario_id, usuario_nome, acao, tabela, registro_id, descricao, campos, antes, depois)
  values (
    coalesce((rec ->> 'clinica_id')::uuid, public.minha_clinica()),
    uid, public.nome_auditoria(), v_acao, TG_TABLE_NAME,
    coalesce(rec ->> 'id', rec ->> 'agendamento_id', rec ->> 'convenio_id', rec ->> 'user_id'),
    v_desc, v_campos, v_antes, v_depois
  );
  return coalesce(new, old);
end; $function$;

create trigger auditoria_guias_convenio after insert or update or delete on public.guias_convenio
  for each row execute function public.auditar_alteracao();
create trigger auditoria_liberacoes after insert or update or delete on public.liberacoes_atendimento
  for each row execute function public.auditar_alteracao();
create trigger auditoria_glosas after insert or update or delete on public.glosas
  for each row execute function public.auditar_alteracao();

-- Anexos das guias (pedido médico / autorização), pasta por clínica.
create policy "equipe de guias le anexos" on storage.objects for select to authenticated
  using (bucket_id = 'guias-convenio' and (storage.foldername(name))[1] = (select public.minha_clinica())::text
    and (public.is_gestor(auth.uid()) or public.has_role(auth.uid(), 'recepcao') or public.has_role(auth.uid(), 'financeiro')));
create policy "equipe de guias envia anexos" on storage.objects for insert to authenticated
  with check (bucket_id = 'guias-convenio' and (storage.foldername(name))[1] = (select public.minha_clinica())::text
    and (public.is_gestor(auth.uid()) or public.has_role(auth.uid(), 'recepcao') or public.has_role(auth.uid(), 'financeiro')));
create policy "equipe de guias remove anexos" on storage.objects for delete to authenticated
  using (bucket_id = 'guias-convenio' and (storage.foldername(name))[1] = (select public.minha_clinica())::text
    and (public.is_gestor(auth.uid()) or public.has_role(auth.uid(), 'recepcao') or public.has_role(auth.uid(), 'financeiro')));