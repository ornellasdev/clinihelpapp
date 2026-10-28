-- ===== Clínicas e desenvolvedores =====
CREATE TABLE public.clinicas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND slug NOT IN ('auth','dev','api','assets','admin','login','entrar','static')),
  ativa boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.clinicas TO authenticated;
GRANT ALL ON public.clinicas TO service_role;
ALTER TABLE public.clinicas ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.desenvolvedores (
  email text PRIMARY KEY,
  clinica_ativa uuid REFERENCES public.clinicas(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.desenvolvedores TO service_role;
ALTER TABLE public.desenvolvedores ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.profiles ADD COLUMN clinica_id uuid REFERENCES public.clinicas(id) ON DELETE CASCADE;
CREATE INDEX profiles_clinica_idx ON public.profiles (clinica_id);

-- Desenvolvedor: e-mail autorizado E sessão com verificação em duas etapas (aal2).
CREATE OR REPLACE FUNCTION public.eh_dev()
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  select coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
     and exists (select 1 from public.desenvolvedores where lower(email) = lower(auth.jwt() ->> 'email'))
$$;

CREATE OR REPLACE FUNCTION public.minha_clinica()
 RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  select case when public.eh_dev()
    then (select clinica_ativa from public.desenvolvedores where lower(email) = lower(auth.jwt() ->> 'email'))
    else (select clinica_id from public.profiles where id = auth.uid())
  end
$$;

CREATE POLICY "le clinica propria" ON public.clinicas FOR SELECT TO authenticated
  USING (id = (select public.minha_clinica()) OR public.eh_dev());

-- ===== clinica_id em todas as tabelas da clínica =====
DO $$
declare t text;
begin
  foreach t in array array['especialidades','salas','pacientes','paciente_documentos','agendamentos','atendimento_financeiro',
    'evolucoes','profissional_config','profissional_especialidades','user_roles','convenios','convenio_valores'] loop
    execute format('ALTER TABLE public.%1$I ADD COLUMN clinica_id uuid NOT NULL DEFAULT public.minha_clinica() REFERENCES public.clinicas(id) ON DELETE CASCADE', t);
    execute format('CREATE INDEX %1$s_clinica_idx ON public.%1$I (clinica_id)', t);
  end loop;
end $$;
ALTER TABLE public.auditoria ADD COLUMN clinica_id uuid REFERENCES public.clinicas(id) ON DELETE CASCADE;
CREATE INDEX auditoria_clinica_idx ON public.auditoria (clinica_id, created_at DESC);

ALTER TABLE public.especialidades DROP CONSTRAINT especialidades_nome_key;
CREATE UNIQUE INDEX especialidades_nome_clinica ON public.especialidades (clinica_id, nome);
DROP INDEX public.convenios_nome_unico;
CREATE UNIQUE INDEX convenios_nome_unico ON public.convenios (clinica_id, lower(nome));

-- ===== Papéis: desenvolvedor tem permissão total; clínica desativada bloqueia a equipe =====
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  select (_user_id = auth.uid() and public.eh_dev())
      or exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;
CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  select (_user_id = auth.uid() and public.eh_dev())
      or exists (
        select 1 from public.user_roles r
        join public.profiles p on p.id = r.user_id
        join public.clinicas c on c.id = p.clinica_id
        where r.user_id = _user_id and p.ativo and c.ativa)
$$;
CREATE OR REPLACE FUNCTION public.is_gestor(_user_id uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  select (_user_id = auth.uid() and public.eh_dev())
      or (public.is_staff(_user_id) and exists (
        select 1 from public.user_roles where user_id = _user_id and role in ('master','administrador')))
$$;
CREATE OR REPLACE FUNCTION public.has_especialidade(_user_id uuid, _esp uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  select (_user_id = auth.uid() and public.eh_dev())
      or (exists (select 1 from public.profissional_especialidades where user_id = _user_id and especialidade_id = _esp)
          and public.is_staff(_user_id))
$$;

-- ===== Garante que registros só apontem para dados da mesma clínica =====
CREATE OR REPLACE FUNCTION public.garantir_mesma_clinica()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
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
  end if;
  if not ok then raise exception 'Registro de outra clínica não permitido' using errcode = '42501'; end if;
  return new;
end $$;
DO $$
declare t text;
begin
  foreach t in array array['agendamentos','evolucoes','paciente_documentos','pacientes','convenio_valores','user_roles','profissional_config','profissional_especialidades'] loop
    execute format('CREATE TRIGGER mesma_clinica BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.garantir_mesma_clinica()', t);
  end loop;
end $$;

-- ===== Gatilhos existentes passam a levar a clínica =====
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
begin
  insert into public.profiles (id, nome, email, clinica_id)
  values (new.id,
    coalesce(new.raw_user_meta_data->>'nome', new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.email,
    nullif(new.raw_user_meta_data->>'clinica_id', '')::uuid)
  on conflict (id) do nothing;
  return new;
end; $$;

CREATE OR REPLACE FUNCTION public.criar_financeiro_agendamento()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
declare v numeric(10,2); vc numeric(10,2); p numeric(5,2);
begin
  select valor_sessao_padrao, percentual_repasse_padrao into v, p
  from public.profissional_config where user_id = new.profissional_id;
  select cv.valor_sessao into vc
  from public.pacientes pa join public.convenio_valores cv on cv.convenio_id = pa.convenio_id
  where pa.id = new.paciente_id;
  insert into public.atendimento_financeiro (agendamento_id, valor, percentual_repasse, clinica_id)
  values (new.id, coalesce(vc, v, 0), coalesce(p, 50), new.clinica_id)
  on conflict do nothing;
  return new;
end; $$;

CREATE OR REPLACE FUNCTION public.nome_auditoria()
 RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  select case when public.eh_dev() then 'Desenvolvedor CliniHelp'
    else (select nome from public.profiles where id = auth.uid()) end
$$;

CREATE OR REPLACE FUNCTION public.auditar_alteracao()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
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

CREATE OR REPLACE FUNCTION public.registrar_acesso(_acao text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
begin
  if auth.uid() is null then raise exception 'Sessão inválida'; end if;
  if _acao not in ('login', 'logout') then raise exception 'Ação inválida'; end if;
  if public.minha_clinica() is null then return; end if;
  insert into public.auditoria (clinica_id, usuario_id, usuario_nome, acao, tabela)
  values (public.minha_clinica(), auth.uid(), public.nome_auditoria(), _acao, 'acesso');
end; $$;

-- ===== Contexto do usuário logado =====
CREATE OR REPLACE FUNCTION public.meu_contexto()
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
declare
  uid uuid := auth.uid();
  dev boolean := public.eh_dev();
  cid uuid := public.minha_clinica();
  pr record; cl record;
  dev_pendente boolean := exists (select 1 from public.desenvolvedores where lower(email) = lower(auth.jwt() ->> 'email'));
begin
  if uid is null then return null; end if;
  select * into pr from public.profiles where id = uid;
  select id, nome, slug, ativa into cl from public.clinicas where id = cid;
  return jsonb_build_object(
    'id', uid,
    'nome', case when dev then 'Desenvolvedor CliniHelp' else coalesce(pr.nome, auth.jwt() ->> 'email') end,
    'email', auth.jwt() ->> 'email',
    'conselho', pr.conselho,
    'registro', pr.registro_profissional,
    'dev', dev,
    'dev_pendente', dev_pendente and not dev,
    'clinica', case when cl.id is null then null else jsonb_build_object('id', cl.id, 'nome', cl.nome, 'slug', cl.slug, 'ativa', cl.ativa) end,
    'papeis', case
      when dev then to_jsonb(array['master','administrador','recepcao','profissional','financeiro'])
      when coalesce(pr.ativo, false) and coalesce(cl.ativa, false) then coalesce((select jsonb_agg(role) from public.user_roles where user_id = uid), '[]'::jsonb)
      else '[]'::jsonb end,
    'especialidades', case
      when dev then coalesce((select jsonb_agg(id) from public.especialidades where clinica_id = cid), '[]'::jsonb)
      else coalesce((select jsonb_agg(especialidade_id) from public.profissional_especialidades where user_id = uid), '[]'::jsonb) end
  );
end; $$;
REVOKE EXECUTE ON FUNCTION public.meu_contexto() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.meu_contexto() TO authenticated;

CREATE OR REPLACE FUNCTION public.dev_entrar_clinica(_slug text)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
declare cid uuid;
begin
  if not public.eh_dev() then raise exception 'Acesso de desenvolvedor necessário' using errcode = '42501'; end if;
  select id into cid from public.clinicas where slug = _slug;
  if cid is null then raise exception 'Clínica não encontrada'; end if;
  update public.desenvolvedores set clinica_ativa = cid where lower(email) = lower(auth.jwt() ->> 'email');
  return cid;
end; $$;
REVOKE EXECUTE ON FUNCTION public.dev_entrar_clinica(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dev_entrar_clinica(text) TO authenticated;

-- ===== Políticas: tudo restrito à clínica de quem acessa =====
DO $$
declare r record;
begin
  for r in select policyname, tablename from pg_policies where schemaname = 'public' and tablename in
    ('profiles','user_roles','especialidades','profissional_especialidades','salas','pacientes','paciente_documentos','agendamentos',
     'atendimento_financeiro','evolucoes','profissional_config','convenios','convenio_valores','auditoria') loop
    execute format('DROP POLICY %I ON public.%I', r.policyname, r.tablename);
  end loop;
end $$;

CREATE POLICY "le perfis" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR (clinica_id = (select public.minha_clinica()) AND public.is_staff(auth.uid())));
CREATE POLICY "gestor edita perfis" ON public.profiles FOR UPDATE TO authenticated
  USING (clinica_id = (select public.minha_clinica()) AND (public.has_role(auth.uid(), 'master') OR (public.is_gestor(auth.uid()) AND NOT public.has_role(id, 'master'))))
  WITH CHECK (clinica_id = (select public.minha_clinica()) AND (public.has_role(auth.uid(), 'master') OR (public.is_gestor(auth.uid()) AND NOT public.has_role(id, 'master'))));

CREATE POLICY "le papeis" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR (clinica_id = (select public.minha_clinica()) AND public.is_staff(auth.uid())));
CREATE POLICY "gestor cria papeis" ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (clinica_id = (select public.minha_clinica()) AND (public.has_role(auth.uid(), 'master') OR (public.is_gestor(auth.uid()) AND role <> 'master' AND NOT public.has_role(user_id, 'master'))));
CREATE POLICY "gestor remove papeis" ON public.user_roles FOR DELETE TO authenticated
  USING (clinica_id = (select public.minha_clinica()) AND (public.has_role(auth.uid(), 'master') OR (public.is_gestor(auth.uid()) AND role <> 'master' AND NOT public.has_role(user_id, 'master'))));

CREATE POLICY "le especialidades" ON public.especialidades FOR SELECT TO authenticated
  USING (clinica_id = (select public.minha_clinica()) AND public.is_staff(auth.uid()));
CREATE POLICY "gestor cria especialidades" ON public.especialidades FOR INSERT TO authenticated
  WITH CHECK (clinica_id = (select public.minha_clinica()) AND public.is_gestor(auth.uid()));
CREATE POLICY "gestor edita especialidades" ON public.especialidades FOR UPDATE TO authenticated
  USING (clinica_id = (select public.minha_clinica()) AND public.is_gestor(auth.uid()));
CREATE POLICY "gestor remove especialidades" ON public.especialidades FOR DELETE TO authenticated
  USING (clinica_id = (select public.minha_clinica()) AND public.is_gestor(auth.uid()));

CREATE POLICY "le vinculos" ON public.profissional_especialidades FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR (clinica_id = (select public.minha_clinica()) AND public.is_staff(auth.uid())));
CREATE POLICY "gestor cria vinculos" ON public.profissional_especialidades FOR INSERT TO authenticated
  WITH CHECK (clinica_id = (select public.minha_clinica()) AND (public.has_role(auth.uid(), 'master') OR (public.is_gestor(auth.uid()) AND user_id <> auth.uid() AND NOT public.has_role(user_id, 'master'))));
CREATE POLICY "gestor remove vinculos" ON public.profissional_especialidades FOR DELETE TO authenticated
  USING (clinica_id = (select public.minha_clinica()) AND (public.has_role(auth.uid(), 'master') OR (public.is_gestor(auth.uid()) AND user_id <> auth.uid() AND NOT public.has_role(user_id, 'master'))));

CREATE POLICY "le salas" ON public.salas FOR SELECT TO authenticated
  USING (clinica_id = (select public.minha_clinica()) AND public.is_staff(auth.uid()));
CREATE POLICY "gestor cria salas" ON public.salas FOR INSERT TO authenticated
  WITH CHECK (clinica_id = (select public.minha_clinica()) AND public.is_gestor(auth.uid()));
CREATE POLICY "gestor edita salas" ON public.salas FOR UPDATE TO authenticated
  USING (clinica_id = (select public.minha_clinica()) AND public.is_gestor(auth.uid()));
CREATE POLICY "gestor remove salas" ON public.salas FOR DELETE TO authenticated
  USING (clinica_id = (select public.minha_clinica()) AND public.is_gestor(auth.uid()));

CREATE POLICY "le pacientes" ON public.pacientes FOR SELECT TO authenticated
  USING (clinica_id = (select public.minha_clinica()) AND public.is_staff(auth.uid()));
CREATE POLICY "recepcao cria pacientes" ON public.pacientes FOR INSERT TO authenticated
  WITH CHECK (clinica_id = (select public.minha_clinica()) AND (public.is_gestor(auth.uid()) OR public.has_role(auth.uid(), 'recepcao')));
CREATE POLICY "recepcao edita pacientes" ON public.pacientes FOR UPDATE TO authenticated
  USING (clinica_id = (select public.minha_clinica()) AND (public.is_gestor(auth.uid()) OR public.has_role(auth.uid(), 'recepcao')));
CREATE POLICY "gestor remove pacientes" ON public.pacientes FOR DELETE TO authenticated
  USING (clinica_id = (select public.minha_clinica()) AND public.is_gestor(auth.uid()));

CREATE POLICY "le documentos" ON public.paciente_documentos FOR SELECT TO authenticated
  USING (clinica_id = (select public.minha_clinica()) AND public.is_staff(auth.uid()));
CREATE POLICY "envia documentos" ON public.paciente_documentos FOR INSERT TO authenticated
  WITH CHECK (clinica_id = (select public.minha_clinica()) AND public.is_staff(auth.uid()) AND enviado_por = auth.uid());
CREATE POLICY "remove documentos" ON public.paciente_documentos FOR DELETE TO authenticated
  USING (clinica_id = (select public.minha_clinica()) AND (public.is_gestor(auth.uid()) OR enviado_por = auth.uid()));

CREATE POLICY "le agenda" ON public.agendamentos FOR SELECT TO authenticated
  USING (clinica_id = (select public.minha_clinica()) AND public.is_staff(auth.uid()));
CREATE POLICY "recepcao agenda" ON public.agendamentos FOR INSERT TO authenticated
  WITH CHECK (clinica_id = (select public.minha_clinica()) AND (public.is_gestor(auth.uid()) OR public.has_role(auth.uid(), 'recepcao')));
CREATE POLICY "edita agenda" ON public.agendamentos FOR UPDATE TO authenticated
  USING (clinica_id = (select public.minha_clinica()) AND (public.is_gestor(auth.uid()) OR public.has_role(auth.uid(), 'recepcao') OR (profissional_id = auth.uid() AND public.is_staff(auth.uid()))));
CREATE POLICY "remove agenda" ON public.agendamentos FOR DELETE TO authenticated
  USING (clinica_id = (select public.minha_clinica()) AND (public.is_gestor(auth.uid()) OR public.has_role(auth.uid(), 'recepcao')));

CREATE POLICY "le financeiro" ON public.atendimento_financeiro FOR SELECT TO authenticated
  USING (clinica_id = (select public.minha_clinica()) AND (public.is_gestor(auth.uid()) OR public.has_role(auth.uid(), 'financeiro')
    OR EXISTS (SELECT 1 FROM public.agendamentos a WHERE a.id = atendimento_financeiro.agendamento_id AND a.profissional_id = auth.uid())));
CREATE POLICY "edita financeiro" ON public.atendimento_financeiro FOR UPDATE TO authenticated
  USING (clinica_id = (select public.minha_clinica()) AND (public.is_gestor(auth.uid()) OR public.has_role(auth.uid(), 'financeiro')));

CREATE POLICY "le prontuario da especialidade" ON public.evolucoes FOR SELECT TO authenticated
  USING (clinica_id = (select public.minha_clinica()) AND public.can_view_especialidade(auth.uid(), especialidade_id));
CREATE POLICY "profissional registra evolucao" ON public.evolucoes FOR INSERT TO authenticated
  WITH CHECK (clinica_id = (select public.minha_clinica()) AND public.has_especialidade(auth.uid(), especialidade_id));
CREATE POLICY "autor edita evolucao" ON public.evolucoes FOR UPDATE TO authenticated
  USING (clinica_id = (select public.minha_clinica()) AND profissional_id = auth.uid() AND public.has_especialidade(auth.uid(), especialidade_id));
CREATE POLICY "master remove evolucao" ON public.evolucoes FOR DELETE TO authenticated
  USING (clinica_id = (select public.minha_clinica()) AND public.has_role(auth.uid(), 'master'));

CREATE POLICY "le config financeira" ON public.profissional_config FOR SELECT TO authenticated
  USING (clinica_id = (select public.minha_clinica()) AND (user_id = auth.uid() OR public.is_gestor(auth.uid()) OR public.has_role(auth.uid(), 'financeiro')));
CREATE POLICY "cria config financeira" ON public.profissional_config FOR INSERT TO authenticated
  WITH CHECK (clinica_id = (select public.minha_clinica()) AND (public.is_gestor(auth.uid()) OR public.has_role(auth.uid(), 'financeiro')));
CREATE POLICY "edita config financeira" ON public.profissional_config FOR UPDATE TO authenticated
  USING (clinica_id = (select public.minha_clinica()) AND (public.is_gestor(auth.uid()) OR public.has_role(auth.uid(), 'financeiro')));

CREATE POLICY "le convenios" ON public.convenios FOR SELECT TO authenticated
  USING (clinica_id = (select public.minha_clinica()) AND public.is_staff(auth.uid()));
CREATE POLICY "financeiro cria convenios" ON public.convenios FOR INSERT TO authenticated
  WITH CHECK (clinica_id = (select public.minha_clinica()) AND (public.is_gestor(auth.uid()) OR public.has_role(auth.uid(), 'financeiro')));
CREATE POLICY "financeiro edita convenios" ON public.convenios FOR UPDATE TO authenticated
  USING (clinica_id = (select public.minha_clinica()) AND (public.is_gestor(auth.uid()) OR public.has_role(auth.uid(), 'financeiro')));
CREATE POLICY "financeiro remove convenios" ON public.convenios FOR DELETE TO authenticated
  USING (clinica_id = (select public.minha_clinica()) AND (public.is_gestor(auth.uid()) OR public.has_role(auth.uid(), 'financeiro')));

CREATE POLICY "financeiro le valores convenio" ON public.convenio_valores FOR SELECT TO authenticated
  USING (clinica_id = (select public.minha_clinica()) AND (public.is_gestor(auth.uid()) OR public.has_role(auth.uid(), 'financeiro')));
CREATE POLICY "financeiro cria valores convenio" ON public.convenio_valores FOR INSERT TO authenticated
  WITH CHECK (clinica_id = (select public.minha_clinica()) AND (public.is_gestor(auth.uid()) OR public.has_role(auth.uid(), 'financeiro')));
CREATE POLICY "financeiro edita valores convenio" ON public.convenio_valores FOR UPDATE TO authenticated
  USING (clinica_id = (select public.minha_clinica()) AND (public.is_gestor(auth.uid()) OR public.has_role(auth.uid(), 'financeiro')));

CREATE POLICY "gestor le auditoria" ON public.auditoria FOR SELECT TO authenticated
  USING (clinica_id = (select public.minha_clinica()) AND (public.has_role(auth.uid(), 'master') OR (public.is_gestor(auth.uid()) AND tabela <> 'evolucoes')));

-- ===== Arquivos: pasta de cada clínica =====
DROP POLICY IF EXISTS "staff le arquivos pacientes" ON storage.objects;
DROP POLICY IF EXISTS "staff envia arquivos pacientes" ON storage.objects;
DROP POLICY IF EXISTS "remove arquivos pacientes" ON storage.objects;
CREATE POLICY "le arquivos da clinica" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'documentos-pacientes' AND (storage.foldername(name))[1] = (select public.minha_clinica())::text AND public.is_staff(auth.uid()));
CREATE POLICY "envia arquivos da clinica" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'documentos-pacientes' AND (storage.foldername(name))[1] = (select public.minha_clinica())::text AND public.is_staff(auth.uid()));
CREATE POLICY "remove arquivos da clinica" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'documentos-pacientes' AND (storage.foldername(name))[1] = (select public.minha_clinica())::text AND (public.is_gestor(auth.uid()) OR owner = auth.uid()));

COMMENT ON FUNCTION public.master_exists() IS 'DEPRECATED: primeiro master agora é criado pelo desenvolvedor por clínica';