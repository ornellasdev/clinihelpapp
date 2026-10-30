ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS senha_temporaria boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.profiles.senha_temporaria IS 'Senha criada pelo master/administrador; a pessoa precisa definir a própria senha antes de acessar os dados.';

-- Sessão segura = verificação em duas etapas concluída (aal2) e senha definida pela própria pessoa.
CREATE OR REPLACE FUNCTION public.acesso_seguro()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
     and not exists (select 1 from public.profiles where id = auth.uid() and senha_temporaria)
$function$;

CREATE OR REPLACE FUNCTION public.minha_clinica()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select case
    when public.eh_dev() then (select clinica_ativa from public.desenvolvedores where lower(email) = lower(auth.jwt() ->> 'email'))
    when public.acesso_seguro() then (select clinica_id from public.profiles where id = auth.uid())
    else null
  end
$function$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select (_user_id = auth.uid() and public.eh_dev())
      or (exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
          and (_user_id is distinct from auth.uid() or public.acesso_seguro()))
$function$;

CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select (_user_id = auth.uid() and public.eh_dev())
      or (exists (
        select 1 from public.user_roles r
        join public.profiles p on p.id = r.user_id
        join public.clinicas c on c.id = p.clinica_id
        where r.user_id = _user_id and p.ativo and c.ativa)
        and (_user_id is distinct from auth.uid() or public.acesso_seguro()))
$function$;

CREATE OR REPLACE FUNCTION public.meu_contexto()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  uid uuid := auth.uid();
  dev boolean := public.eh_dev();
  aal text := coalesce(auth.jwt() ->> 'aal', '');
  cid uuid;
  pr record; cl record;
  dev_pendente boolean := exists (select 1 from public.desenvolvedores where lower(email) = lower(auth.jwt() ->> 'email'));
  mfa boolean;
  pendencia text := null;
begin
  if uid is null then return null; end if;
  select * into pr from public.profiles where id = uid;
  cid := case when dev then public.minha_clinica() else pr.clinica_id end;
  select id, nome, slug, ativa into cl from public.clinicas where id = cid;
  mfa := exists (select 1 from auth.mfa_factors where user_id = uid and status = 'verified');
  if not dev and pr.clinica_id is not null then
    pendencia := case
      when not mfa and coalesce(pr.senha_temporaria, false) then 'senha'
      when mfa and aal <> 'aal2' then 'codigo'
      when coalesce(pr.senha_temporaria, false) then 'senha'
      when not mfa then 'cadastro_2fa'
      else null end;
  end if;
  return jsonb_build_object(
    'id', uid,
    'nome', case when dev then 'Desenvolvedor CliniHelp' else coalesce(pr.nome, auth.jwt() ->> 'email') end,
    'email', auth.jwt() ->> 'email',
    'conselho', pr.conselho,
    'registro', pr.registro_profissional,
    'dev', dev,
    'dev_pendente', dev_pendente and not dev,
    'pendencia', pendencia,
    'clinica', case when cl.id is null then null else jsonb_build_object('id', cl.id, 'nome', cl.nome, 'slug', cl.slug, 'ativa', cl.ativa) end,
    'papeis', case
      when dev then to_jsonb(array['master','administrador','recepcao','profissional','financeiro'])
      when coalesce(pr.ativo, false) and coalesce(cl.ativa, false) then coalesce((select jsonb_agg(role) from public.user_roles where user_id = uid), '[]'::jsonb)
      else '[]'::jsonb end,
    'especialidades', case
      when dev then coalesce((select jsonb_agg(id) from public.especialidades where clinica_id = cid), '[]'::jsonb)
      else coalesce((select jsonb_agg(especialidade_id) from public.profissional_especialidades where user_id = uid), '[]'::jsonb) end
  );
end; $function$;