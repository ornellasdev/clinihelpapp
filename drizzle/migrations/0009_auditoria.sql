CREATE TABLE public.auditoria (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  usuario_id uuid,
  usuario_nome text,
  acao text NOT NULL,
  tabela text NOT NULL,
  registro_id text,
  descricao text,
  campos text[],
  antes jsonb,
  depois jsonb
);
CREATE INDEX auditoria_created_at_idx ON public.auditoria (created_at DESC);
CREATE INDEX auditoria_usuario_idx ON public.auditoria (usuario_id, created_at DESC);
CREATE INDEX auditoria_tabela_idx ON public.auditoria (tabela, created_at DESC);
GRANT SELECT ON public.auditoria TO authenticated;
GRANT ALL ON public.auditoria TO service_role;
ALTER TABLE public.auditoria ENABLE ROW LEVEL SECURITY;
-- Registros do prontuário só para o master; o resto para master e administrador. Ninguém edita ou apaga.
CREATE POLICY "gestor le auditoria" ON public.auditoria FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'master') OR (public.is_gestor(auth.uid()) AND tabela <> 'evolucoes'));

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
  -- Ações feitas pelo servidor (sem usuário) são registradas explicitamente pelas funções da equipe.
  if uid is null then return coalesce(new, old); end if;
  -- O financeiro da sessão nasce automaticamente com o agendamento; não duplica o registro.
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
    v_depois := v_new - 'created_at' - 'updated_at';
    v_antes := null;
  else
    v_antes := v_old - 'created_at' - 'updated_at';
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

  insert into public.auditoria (usuario_id, usuario_nome, acao, tabela, registro_id, descricao, campos, antes, depois)
  values (
    uid, (select nome from public.profiles where id = uid), v_acao, TG_TABLE_NAME,
    coalesce(rec ->> 'id', rec ->> 'agendamento_id', rec ->> 'convenio_id', rec ->> 'user_id'),
    v_desc, v_campos, v_antes, v_depois
  );
  return coalesce(new, old);
end; $function$;

DO $$
declare t text;
begin
  foreach t in array array['pacientes','paciente_documentos','agendamentos','atendimento_financeiro','evolucoes','profiles',
    'user_roles','profissional_especialidades','profissional_config','salas','especialidades','convenios','convenio_valores'] loop
    execute format('CREATE TRIGGER auditoria_%1$s AFTER INSERT OR UPDATE OR DELETE ON public.%1$I FOR EACH ROW EXECUTE FUNCTION public.auditar_alteracao()', t);
  end loop;
end $$;

-- Entrada e saída do sistema, registradas pelo próprio usuário logado.
CREATE OR REPLACE FUNCTION public.registrar_acesso(_acao text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
begin
  if auth.uid() is null then raise exception 'Sessão inválida'; end if;
  if _acao not in ('login', 'logout') then raise exception 'Ação inválida'; end if;
  insert into public.auditoria (usuario_id, usuario_nome, acao, tabela)
  values (auth.uid(), (select nome from public.profiles where id = auth.uid()), _acao, 'acesso');
end; $function$;
REVOKE EXECUTE ON FUNCTION public.registrar_acesso(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_acesso(text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.auditar_alteracao() FROM PUBLIC, anon, authenticated;