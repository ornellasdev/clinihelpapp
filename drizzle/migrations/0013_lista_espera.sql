create table public.lista_espera (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null default public.minha_clinica() references public.clinicas(id) on delete cascade,
  paciente_id uuid not null references public.pacientes(id) on delete cascade,
  especialidade_id uuid not null references public.especialidades(id) on delete cascade,
  profissional_id uuid references public.profiles(id) on delete set null,
  dias_semana smallint[] not null default '{}' check (dias_semana <@ array[1,2,3,4,5,6]::smallint[]),
  periodos text[] not null default '{}' check (periodos <@ array['manha','tarde','noite']::text[]),
  horario_obs text check (char_length(horario_obs) <= 200),
  prioridade text not null default 'normal' check (prioridade in ('normal', 'alta')),
  observacoes text check (char_length(observacoes) <= 1000),
  status text not null default 'aguardando' check (status in ('aguardando', 'agendado', 'desistiu')),
  encerrado_em timestamptz,
  criado_por uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index lista_espera_clinica_status_idx on public.lista_espera (clinica_id, status, especialidade_id, created_at);
grant select, insert, update, delete on public.lista_espera to authenticated;
grant all on public.lista_espera to service_role;
alter table public.lista_espera enable row level security;

create policy "equipe le lista de espera" on public.lista_espera for select to authenticated
  using (clinica_id = (select public.minha_clinica()) and public.is_staff(auth.uid()));
create policy "recepcao cria lista de espera" on public.lista_espera for insert to authenticated
  with check (clinica_id = (select public.minha_clinica()) and (public.is_gestor(auth.uid()) or public.has_role(auth.uid(), 'recepcao')));
create policy "recepcao edita lista de espera" on public.lista_espera for update to authenticated
  using (clinica_id = (select public.minha_clinica()) and (public.is_gestor(auth.uid()) or public.has_role(auth.uid(), 'recepcao')))
  with check (clinica_id = (select public.minha_clinica()));
create policy "recepcao remove lista de espera" on public.lista_espera for delete to authenticated
  using (clinica_id = (select public.minha_clinica()) and (public.is_gestor(auth.uid()) or public.has_role(auth.uid(), 'recepcao')));

create trigger trg_lista_espera_updated before update on public.lista_espera
  for each row execute function public.set_updated_at();

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
  elsif TG_TABLE_NAME = 'paciente_documentos' then
    ok := exists (select 1 from pacientes where id = new.paciente_id and clinica_id = new.clinica_id);
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
  end if;
  if not ok then raise exception 'Registro de outra clínica não permitido' using errcode = '42501'; end if;
  return new;
end $function$;

create trigger lista_espera_mesma_clinica before insert or update on public.lista_espera
  for each row execute function public.garantir_mesma_clinica();
create trigger auditoria_lista_espera after insert or update or delete on public.lista_espera
  for each row execute function public.auditar_alteracao();