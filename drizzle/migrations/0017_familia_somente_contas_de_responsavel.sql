-- Área da família: só contas de responsável (sem clínica e sem papel na equipe).
-- Contas da equipe são criadas pela clínica com e-mail escolhido por ela, então nunca acessam dados de famílias.
create or replace function public.familia_sessao_ok()
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null
    and not exists (select 1 from public.profiles where id = auth.uid() and clinica_id is not null)
    and not exists (select 1 from public.user_roles where user_id = auth.uid())
    and not exists (select 1 from public.desenvolvedores d join auth.users u on lower(u.email) = lower(d.email) where u.id = auth.uid())
$$;