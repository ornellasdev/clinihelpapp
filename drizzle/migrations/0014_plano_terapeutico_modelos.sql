-- Metas do plano terapêutico (dado clínico: mesma regra do prontuário)
create table public.plano_metas (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null default public.minha_clinica() references public.clinicas(id) on delete cascade,
  paciente_id uuid not null references public.pacientes(id) on delete cascade,
  especialidade_id uuid not null references public.especialidades(id) on delete cascade,
  titulo text not null check (char_length(titulo) between 1 and 200),
  descricao text check (char_length(descricao) <= 1000),
  status text not null default 'ativa' check (status in ('ativa', 'alcancada', 'pausada')),
  data_inicio date not null default current_date,
  prazo date,
  criado_por uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index plano_metas_paciente_idx on public.plano_metas (clinica_id, paciente_id, especialidade_id);
grant select, insert, update, delete on public.plano_metas to authenticated;
grant all on public.plano_metas to service_role;
alter table public.plano_metas enable row level security;

create policy "le metas da especialidade" on public.plano_metas for select to authenticated
  using (clinica_id = (select public.minha_clinica()) and public.can_view_especialidade(auth.uid(), especialidade_id));
create policy "profissional cria meta" on public.plano_metas for insert to authenticated
  with check (clinica_id = (select public.minha_clinica()) and (public.has_especialidade(auth.uid(), especialidade_id) or public.has_role(auth.uid(), 'master')));
create policy "profissional edita meta" on public.plano_metas for update to authenticated
  using (clinica_id = (select public.minha_clinica()) and (public.has_especialidade(auth.uid(), especialidade_id) or public.has_role(auth.uid(), 'master')))
  with check (clinica_id = (select public.minha_clinica()) and (public.has_especialidade(auth.uid(), especialidade_id) or public.has_role(auth.uid(), 'master')));
create policy "profissional remove meta" on public.plano_metas for delete to authenticated
  using (clinica_id = (select public.minha_clinica()) and (public.has_especialidade(auth.uid(), especialidade_id) or public.has_role(auth.uid(), 'master')));

create trigger trg_plano_metas_updated before update on public.plano_metas
  for each row execute function public.set_updated_at();

-- Progresso de cada meta registrado na evolução (nível 1 a 5)
create table public.evolucao_metas (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null default public.minha_clinica() references public.clinicas(id) on delete cascade,
  evolucao_id uuid not null references public.evolucoes(id) on delete cascade,
  meta_id uuid not null references public.plano_metas(id) on delete cascade,
  paciente_id uuid not null references public.pacientes(id) on delete cascade,
  especialidade_id uuid not null references public.especialidades(id) on delete cascade,
  nivel smallint not null check (nivel between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (evolucao_id, meta_id)
);
create index evolucao_metas_paciente_idx on public.evolucao_metas (clinica_id, paciente_id, meta_id);
grant select, insert, update, delete on public.evolucao_metas to authenticated;
grant all on public.evolucao_metas to service_role;
alter table public.evolucao_metas enable row level security;

create policy "le progresso da especialidade" on public.evolucao_metas for select to authenticated
  using (clinica_id = (select public.minha_clinica()) and public.can_view_especialidade(auth.uid(), especialidade_id));
create policy "autor registra progresso" on public.evolucao_metas for insert to authenticated
  with check (clinica_id = (select public.minha_clinica()) and public.has_especialidade(auth.uid(), especialidade_id)
    and exists (select 1 from public.evolucoes e where e.id = evolucao_id and e.profissional_id = auth.uid()));
create policy "autor edita progresso" on public.evolucao_metas for update to authenticated
  using (clinica_id = (select public.minha_clinica()) and public.has_especialidade(auth.uid(), especialidade_id)
    and exists (select 1 from public.evolucoes e where e.id = evolucao_id and e.profissional_id = auth.uid()))
  with check (clinica_id = (select public.minha_clinica()));
create policy "autor remove progresso" on public.evolucao_metas for delete to authenticated
  using (clinica_id = (select public.minha_clinica()) and (public.has_role(auth.uid(), 'master') or (public.has_especialidade(auth.uid(), especialidade_id)
    and exists (select 1 from public.evolucoes e where e.id = evolucao_id and e.profissional_id = auth.uid()))));

create trigger trg_evolucao_metas_updated before update on public.evolucao_metas
  for each row execute function public.set_updated_at();

-- Modelos de evolução por especialidade (não contêm dados de pacientes)
create table public.modelos_evolucao (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null default public.minha_clinica() references public.clinicas(id) on delete cascade,
  especialidade_id uuid not null references public.especialidades(id) on delete cascade,
  nome text not null check (char_length(nome) between 1 and 80),
  conteudo text not null check (char_length(conteudo) between 1 and 5000),
  criado_por uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index modelos_evolucao_esp_idx on public.modelos_evolucao (clinica_id, especialidade_id);
grant select, insert, update, delete on public.modelos_evolucao to authenticated;
grant all on public.modelos_evolucao to service_role;
alter table public.modelos_evolucao enable row level security;

create policy "equipe le modelos" on public.modelos_evolucao for select to authenticated
  using (clinica_id = (select public.minha_clinica()) and public.is_staff(auth.uid()));
create policy "profissional cria modelo" on public.modelos_evolucao for insert to authenticated
  with check (clinica_id = (select public.minha_clinica()) and (public.has_especialidade(auth.uid(), especialidade_id) or public.is_gestor(auth.uid())));
create policy "profissional edita modelo" on public.modelos_evolucao for update to authenticated
  using (clinica_id = (select public.minha_clinica()) and (public.has_especialidade(auth.uid(), especialidade_id) or public.is_gestor(auth.uid())))
  with check (clinica_id = (select public.minha_clinica()) and (public.has_especialidade(auth.uid(), especialidade_id) or public.is_gestor(auth.uid())));
create policy "profissional remove modelo" on public.modelos_evolucao for delete to authenticated
  using (clinica_id = (select public.minha_clinica()) and (public.has_especialidade(auth.uid(), especialidade_id) or public.is_gestor(auth.uid())));

create trigger trg_modelos_evolucao_updated before update on public.modelos_evolucao
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

create trigger plano_metas_mesma_clinica before insert or update on public.plano_metas
  for each row execute function public.garantir_mesma_clinica();
create trigger evolucao_metas_mesma_clinica before insert or update on public.evolucao_metas
  for each row execute function public.garantir_mesma_clinica();
create trigger modelos_evolucao_mesma_clinica before insert or update on public.modelos_evolucao
  for each row execute function public.garantir_mesma_clinica();

create trigger auditoria_plano_metas after insert or update or delete on public.plano_metas
  for each row execute function public.auditar_alteracao();
create trigger auditoria_evolucao_metas after insert or update or delete on public.evolucao_metas
  for each row execute function public.auditar_alteracao();
create trigger auditoria_modelos_evolucao after insert or update or delete on public.modelos_evolucao
  for each row execute function public.auditar_alteracao();

-- Administrador não vê na auditoria nada clínico (prontuário, metas e progresso)
drop policy if exists "gestor le auditoria" on public.auditoria;
create policy "gestor le auditoria" on public.auditoria for select to authenticated
  using (clinica_id = (select public.minha_clinica()) and (public.has_role(auth.uid(), 'master')
    or (public.is_gestor(auth.uid()) and tabela not in ('evolucoes', 'plano_metas', 'evolucao_metas'))));