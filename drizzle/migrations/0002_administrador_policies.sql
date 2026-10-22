-- Gestor = master ou administrador (administrador tem tudo do master, exceto prontuários)
create or replace function public.is_gestor(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_staff(_user_id) and exists (
    select 1 from public.user_roles where user_id = _user_id and role in ('master','administrador')
  )
$$;

-- AGENDAMENTOS
drop policy if exists "edita agenda" on public.agendamentos;
create policy "edita agenda" on public.agendamentos for update to authenticated
  using (public.is_gestor(auth.uid()) or public.has_role(auth.uid(),'recepcao') or (profissional_id = auth.uid() and public.is_staff(auth.uid())));
drop policy if exists "remove agenda" on public.agendamentos;
create policy "remove agenda" on public.agendamentos for delete to authenticated
  using (public.is_gestor(auth.uid()) or public.has_role(auth.uid(),'recepcao'));
drop policy if exists "recepcao agenda" on public.agendamentos;
create policy "recepcao agenda" on public.agendamentos for insert to authenticated
  with check (public.is_gestor(auth.uid()) or public.has_role(auth.uid(),'recepcao'));

-- FINANCEIRO
drop policy if exists "le financeiro" on public.atendimento_financeiro;
create policy "le financeiro" on public.atendimento_financeiro for select to authenticated
  using (public.is_gestor(auth.uid()) or public.has_role(auth.uid(),'financeiro')
    or exists (select 1 from public.agendamentos a where a.id = atendimento_financeiro.agendamento_id and a.profissional_id = auth.uid()));
drop policy if exists "edita financeiro" on public.atendimento_financeiro;
create policy "edita financeiro" on public.atendimento_financeiro for update to authenticated
  using (public.is_gestor(auth.uid()) or public.has_role(auth.uid(),'financeiro'));

-- ESPECIALIDADES
drop policy if exists "master gerencia especialidades del" on public.especialidades;
create policy "gestor gerencia especialidades del" on public.especialidades for delete to authenticated using (public.is_gestor(auth.uid()));
drop policy if exists "master gerencia especialidades ins" on public.especialidades;
create policy "gestor gerencia especialidades ins" on public.especialidades for insert to authenticated with check (public.is_gestor(auth.uid()));
drop policy if exists "master gerencia especialidades upd" on public.especialidades;
create policy "gestor gerencia especialidades upd" on public.especialidades for update to authenticated using (public.is_gestor(auth.uid()));

-- DOCUMENTOS
drop policy if exists "remove documentos" on public.paciente_documentos;
create policy "remove documentos" on public.paciente_documentos for delete to authenticated
  using (public.is_gestor(auth.uid()) or enviado_por = auth.uid());
drop policy if exists "remove arquivos pacientes" on storage.objects;
create policy "remove arquivos pacientes" on storage.objects for delete to authenticated
  using (bucket_id = 'documentos-pacientes' and (public.is_gestor(auth.uid()) or owner = auth.uid()));

-- PACIENTES
drop policy if exists "master remove pacientes" on public.pacientes;
create policy "gestor remove pacientes" on public.pacientes for delete to authenticated using (public.is_gestor(auth.uid()));
drop policy if exists "recepcao cria pacientes" on public.pacientes;
create policy "recepcao cria pacientes" on public.pacientes for insert to authenticated
  with check (public.is_gestor(auth.uid()) or public.has_role(auth.uid(),'recepcao'));
drop policy if exists "recepcao edita pacientes" on public.pacientes;
create policy "recepcao edita pacientes" on public.pacientes for update to authenticated
  using (public.is_gestor(auth.uid()) or public.has_role(auth.uid(),'recepcao'));

-- PERFIS: administrador não edita contas master
drop policy if exists "master edita perfis" on public.profiles;
create policy "gestor edita perfis" on public.profiles for update to authenticated
  using (public.has_role(auth.uid(),'master') or (public.is_gestor(auth.uid()) and not public.has_role(id,'master')))
  with check (public.has_role(auth.uid(),'master') or (public.is_gestor(auth.uid()) and not public.has_role(id,'master')));

-- CONFIG FINANCEIRA
drop policy if exists "cria config financeira" on public.profissional_config;
create policy "cria config financeira" on public.profissional_config for insert to authenticated
  with check (public.is_gestor(auth.uid()) or public.has_role(auth.uid(),'financeiro'));
drop policy if exists "le config financeira" on public.profissional_config;
create policy "le config financeira" on public.profissional_config for select to authenticated
  using (user_id = auth.uid() or public.is_gestor(auth.uid()) or public.has_role(auth.uid(),'financeiro'));
drop policy if exists "edita config financeira" on public.profissional_config;
create policy "edita config financeira" on public.profissional_config for update to authenticated
  using (public.is_gestor(auth.uid()) or public.has_role(auth.uid(),'financeiro'));

-- VÍNCULOS DE ESPECIALIDADE: administrador não vincula a si mesmo (evita acesso a prontuário)
drop policy if exists "master cria vinculos" on public.profissional_especialidades;
create policy "gestor cria vinculos" on public.profissional_especialidades for insert to authenticated
  with check (public.has_role(auth.uid(),'master') or (public.is_gestor(auth.uid()) and user_id <> auth.uid() and not public.has_role(user_id,'master')));
drop policy if exists "master remove vinculos" on public.profissional_especialidades;
create policy "gestor remove vinculos" on public.profissional_especialidades for delete to authenticated
  using (public.has_role(auth.uid(),'master') or (public.is_gestor(auth.uid()) and user_id <> auth.uid() and not public.has_role(user_id,'master')));

-- SALAS
drop policy if exists "master edita salas" on public.salas;
create policy "gestor edita salas" on public.salas for update to authenticated using (public.is_gestor(auth.uid()));
drop policy if exists "master cria salas" on public.salas;
create policy "gestor cria salas" on public.salas for insert to authenticated with check (public.is_gestor(auth.uid()));
drop policy if exists "master remove salas" on public.salas;
create policy "gestor remove salas" on public.salas for delete to authenticated using (public.is_gestor(auth.uid()));

-- PAPÉIS: administrador não concede/remove master nem mexe em contas master
drop policy if exists "master cria papeis" on public.user_roles;
create policy "gestor cria papeis" on public.user_roles for insert to authenticated
  with check (public.has_role(auth.uid(),'master') or (public.is_gestor(auth.uid()) and role <> 'master' and not public.has_role(user_id,'master')));
drop policy if exists "master remove papeis" on public.user_roles;
create policy "gestor remove papeis" on public.user_roles for delete to authenticated
  using (public.has_role(auth.uid(),'master') or (public.is_gestor(auth.uid()) and role <> 'master' and not public.has_role(user_id,'master')));

-- Prontuário (evolucoes) e can_view_especialidade permanecem exclusivos do master + profissionais da especialidade.