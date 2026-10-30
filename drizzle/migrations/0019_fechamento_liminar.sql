-- Fechamento mensal da Liminar: lista de presença + nota fiscal; pagamento 30 dias após a emissão da NF.
create table public.faturas_liminar (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null default public.minha_clinica() references public.clinicas(id) on delete cascade,
  paciente_id uuid not null references public.pacientes(id) on delete cascade,
  convenio_id uuid not null references public.convenios(id),
  competencia date not null check (extract(day from competencia) = 1),
  quantidade_sessoes integer not null default 0,
  valor numeric(12,2) not null default 0,
  nf_numero text check (char_length(btrim(nf_numero)) between 1 and 60),
  nf_emissao date,
  vencimento date generated always as (nf_emissao + 30) stored,
  status text not null default 'aguardando_nf' check (status in ('aguardando_nf', 'nf_emitida', 'paga')),
  pago_em date,
  valor_pago numeric(12,2) check (valor_pago >= 0),
  observacoes text check (char_length(observacoes) <= 1000),
  criado_por uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fatura_liminar_nf_completa check (status = 'aguardando_nf' or (nf_numero is not null and nf_emissao is not null)),
  constraint fatura_liminar_paga_completa check (status <> 'paga' or pago_em is not null),
  constraint fatura_liminar_unica unique (paciente_id, competencia)
);
create index faturas_liminar_clinica_idx on public.faturas_liminar (clinica_id, status, vencimento);
grant select, insert, update, delete on public.faturas_liminar to authenticated;
grant all on public.faturas_liminar to service_role;
alter table public.faturas_liminar enable row level security;

create policy "financeiro le faturas liminar" on public.faturas_liminar for select to authenticated
  using (clinica_id = (select public.minha_clinica()) and (public.is_gestor(auth.uid()) or public.has_role(auth.uid(), 'financeiro')));
create policy "financeiro cria faturas liminar" on public.faturas_liminar for insert to authenticated
  with check (clinica_id = (select public.minha_clinica()) and (public.is_gestor(auth.uid()) or public.has_role(auth.uid(), 'financeiro')));
create policy "financeiro edita faturas liminar" on public.faturas_liminar for update to authenticated
  using (clinica_id = (select public.minha_clinica()) and (public.is_gestor(auth.uid()) or public.has_role(auth.uid(), 'financeiro')))
  with check (clinica_id = (select public.minha_clinica()));
create policy "financeiro desfaz fechamento nao pago" on public.faturas_liminar for delete to authenticated
  using (clinica_id = (select public.minha_clinica()) and status <> 'paga' and (public.is_gestor(auth.uid()) or public.has_role(auth.uid(), 'financeiro')));

create trigger trg_faturas_liminar_updated before update on public.faturas_liminar
  for each row execute function public.set_updated_at();

-- Sessões que entraram em cada fechamento (uma sessão só entra em um fechamento).
create table public.fatura_liminar_itens (
  agendamento_id uuid primary key references public.agendamentos(id) on delete cascade,
  fatura_id uuid not null references public.faturas_liminar(id) on delete cascade,
  clinica_id uuid not null default public.minha_clinica() references public.clinicas(id) on delete cascade
);
create index fatura_liminar_itens_fatura_idx on public.fatura_liminar_itens (fatura_id);
grant select, insert, delete on public.fatura_liminar_itens to authenticated;
grant all on public.fatura_liminar_itens to service_role;
alter table public.fatura_liminar_itens enable row level security;

create policy "financeiro le itens liminar" on public.fatura_liminar_itens for select to authenticated
  using (clinica_id = (select public.minha_clinica()) and (public.is_gestor(auth.uid()) or public.has_role(auth.uid(), 'financeiro')));
create policy "financeiro cria itens liminar" on public.fatura_liminar_itens for insert to authenticated
  with check (clinica_id = (select public.minha_clinica()) and (public.is_gestor(auth.uid()) or public.has_role(auth.uid(), 'financeiro')));
create policy "financeiro remove itens liminar" on public.fatura_liminar_itens for delete to authenticated
  using (clinica_id = (select public.minha_clinica()) and (public.is_gestor(auth.uid()) or public.has_role(auth.uid(), 'financeiro')));

-- Itens só em fechamento ainda não pago.
create or replace function public.item_liminar_fatura_aberta()
 returns trigger language plpgsql security definer set search_path to 'public'
as $function$
declare v_id uuid := coalesce(new.fatura_id, old.fatura_id);
begin
  if TG_OP = 'DELETE' and not exists (select 1 from faturas_liminar where id = v_id) then return old; end if;
  if exists (select 1 from faturas_liminar where id = v_id and status = 'paga') then
    raise exception 'Fechamento já pago não pode ser alterado' using errcode = '42501';
  end if;
  return coalesce(new, old);
end $function$;
create trigger fatura_liminar_itens_aberta before insert or delete on public.fatura_liminar_itens
  for each row execute function public.item_liminar_fatura_aberta();

-- Quantidade e valor do fechamento = soma das sessões incluídas.
create or replace function public.recalcular_fatura_liminar()
 returns trigger language plpgsql security definer set search_path to 'public'
as $function$
declare v_id uuid := coalesce(new.fatura_id, old.fatura_id);
begin
  update faturas_liminar f set
    quantidade_sessoes = s.n,
    valor = s.total
  from (
    select count(*)::int as n, coalesce(sum(af.valor), 0) as total
    from fatura_liminar_itens i left join atendimento_financeiro af on af.agendamento_id = i.agendamento_id
    where i.fatura_id = v_id
  ) s
  where f.id = v_id;
  return null;
end $function$;
create trigger fatura_liminar_itens_total after insert or delete on public.fatura_liminar_itens
  for each row execute function public.recalcular_fatura_liminar();

-- Pagamento da NF marca as sessões do fechamento como pagas (e volta para pendente se desfeito).
create or replace function public.sincronizar_pagamento_liminar()
 returns trigger language plpgsql security definer set search_path to 'public'
as $function$
begin
  if new.status = 'paga' and old.status is distinct from 'paga' then
    update atendimento_financeiro set pagamento_status = 'pago'
    where agendamento_id in (select agendamento_id from fatura_liminar_itens where fatura_id = new.id);
  elsif old.status = 'paga' and new.status <> 'paga' then
    update atendimento_financeiro set pagamento_status = 'pendente'
    where agendamento_id in (select agendamento_id from fatura_liminar_itens where fatura_id = new.id);
  end if;
  return null;
end $function$;
create trigger faturas_liminar_pagamento after update of status on public.faturas_liminar
  for each row execute function public.sincronizar_pagamento_liminar();

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
  elsif TG_TABLE_NAME = 'faturas_liminar' then
    ok := exists (select 1 from pacientes where id = new.paciente_id and clinica_id = new.clinica_id)
      and exists (select 1 from convenios where id = new.convenio_id and clinica_id = new.clinica_id);
  elsif TG_TABLE_NAME = 'fatura_liminar_itens' then
    -- Sessão realizada, do mesmo paciente e do mês do fechamento.
    ok := exists (
      select 1 from agendamentos a join faturas_liminar f on f.id = new.fatura_id
      where a.id = new.agendamento_id and a.clinica_id = new.clinica_id and f.clinica_id = new.clinica_id
        and a.paciente_id = f.paciente_id and a.status = 'realizado'
        and date_trunc('month', a.inicio at time zone 'America/Sao_Paulo')::date = f.competencia);
  end if;
  if not ok then raise exception 'Registro de outra clínica não permitido' using errcode = '42501'; end if;
  return new;
end $function$;

create trigger faturas_liminar_mesma_clinica before insert or update on public.faturas_liminar
  for each row execute function public.garantir_mesma_clinica();
create trigger fatura_liminar_itens_mesma_clinica before insert or update on public.fatura_liminar_itens
  for each row execute function public.garantir_mesma_clinica();

create trigger auditoria_faturas_liminar after insert or update or delete on public.faturas_liminar
  for each row execute function public.auditar_alteracao();
