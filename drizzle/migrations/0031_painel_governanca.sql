-- Etapa 3 — Painel de Segurança, Banco e Auditoria (somente gestão: master/administrador).
-- Devolve contagens e verificações; nenhum conteúdo clínico.
create or replace function public.painel_governanca()
returns jsonb language plpgsql stable security definer set search_path = public, pg_catalog as $$
declare
  c uuid := public.minha_clinica();
  desde timestamptz := now() - interval '30 days';
  r jsonb;
begin
  if c is null or not public.is_gestor(auth.uid()) then
    raise exception 'Acesso restrito à gestão da clínica.' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'lgpd', (
      select jsonb_build_object(
        'ativos', count(*) filter (where p.ativo),
        'assinado', count(*) filter (where p.ativo and p.lgpd_consentimento_status = 'assinado'),
        'pendente', count(*) filter (where p.ativo and p.lgpd_consentimento_status = 'pendente'),
        'revogado', count(*) filter (where p.ativo and p.lgpd_consentimento_status = 'revogado'),
        'clinicos_no_cadastro', count(*) filter (where coalesce(p.diagnostico, p.cid, p.alergias, p.medicamentos) is not null),
        'pendentes_lista', coalesce((
          select jsonb_agg(x order by x->>'nome') from (
            select jsonb_build_object('id', q.id, 'nome', q.nome, 'status', q.lgpd_consentimento_status, 'desde', q.created_at) x
            from public.pacientes q
            where q.clinica_id = c and q.ativo and q.lgpd_consentimento_status <> 'assinado'
            order by q.nome limit 100) s), '[]'::jsonb))
      from public.pacientes p where p.clinica_id = c),
    'equipe', (
      select jsonb_build_object(
        'ativos', count(*) filter (where e.ativo),
        'sem_2fa', count(*) filter (where e.ativo and not e.tem_2fa),
        'senha_temporaria', count(*) filter (where e.ativo and e.senha_temporaria),
        'inativos', count(*) filter (where not e.ativo),
        'contas', coalesce(jsonb_agg(jsonb_build_object(
          'id', e.id, 'nome', e.nome, 'papeis', e.papeis, 'ativo', e.ativo,
          'senha_temporaria', e.senha_temporaria, 'tem_2fa', e.tem_2fa, 'ultimo_acesso', e.ultimo_acesso)
          order by e.ativo desc, e.nome), '[]'::jsonb))
      from (
        select pr.id, pr.nome, pr.ativo, pr.senha_temporaria,
          coalesce((select array_agg(ur.role::text order by ur.role) from public.user_roles ur where ur.user_id = pr.id), '{}') as papeis,
          exists (select 1 from auth.mfa_factors f where f.user_id = pr.id and f.status = 'verified') as tem_2fa,
          (select max(a.created_at) from public.auditoria a where a.usuario_id = pr.id and a.acao = 'login') as ultimo_acesso
        from public.profiles pr where pr.clinica_id = c
      ) e),
    'auditoria', (
      select jsonb_build_object(
        'eventos_30d', count(*),
        'logins_30d', count(*) filter (where a.acao = 'login'),
        'saidas_inatividade_30d', count(*) filter (where a.acao = 'logout_inatividade'),
        'exclusoes_30d', count(*) filter (where a.acao = 'removeu'),
        'ultimo_registro', max(a.created_at))
      from public.auditoria a where a.clinica_id = c and a.created_at >= desde),
    'banco', jsonb_build_object(
      'tabelas_sem_rls', coalesce((
        select jsonb_agg(t.relname order by t.relname) from pg_class t
        where t.relnamespace = 'public'::regnamespace and t.relkind = 'r' and not t.relrowsecurity), '[]'::jsonb),
      'views_sem_invoker', coalesce((
        select jsonb_agg(v.relname order by v.relname) from pg_class v
        where v.relnamespace = 'public'::regnamespace and v.relkind = 'v'
          and not coalesce(v.reloptions @> array['security_invoker=true'], false)), '[]'::jsonb),
      'buckets_publicos', coalesce((select jsonb_agg(b.id order by b.id) from storage.buckets b where b.public), '[]'::jsonb),
      'funcoes_anonimas', (
        select count(*) from pg_proc p
        where p.pronamespace = 'public'::regnamespace
          and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
          and has_function_privilege('anon', p.oid, 'EXECUTE')),
      'auditoria_imutavel', exists (select 1 from pg_trigger where tgrelid = 'public.auditoria'::regclass and tgname = 'trg_auditoria_imutavel' and tgenabled <> 'D'),
      'evolucao_imutavel', exists (select 1 from pg_trigger where tgrelid = 'public.evolucoes'::regclass and tgname = 'trg_evolucoes_imutavel' and tgenabled <> 'D'),
      'evolucao_sem_exclusao', exists (select 1 from pg_trigger where tgrelid = 'public.evolucoes'::regclass and tgname = 'trg_evolucoes_sem_exclusao' and tgenabled <> 'D'),
      'adendo_imutavel', exists (select 1 from pg_trigger where tgrelid = 'public.evolucao_adendos'::regclass and tgname = 'trg_adendo_imutavel' and tgenabled <> 'D'),
      'tabelas_auditadas', (select count(distinct tgrelid) from pg_trigger where tgname like 'auditoria\_%' and tgfoid = 'public.auditar_alteracao'::regproc)),
    'integridade', jsonb_build_object(
      'finalizadas_sem_evolucao', (
        select count(*) from public.agendamentos a
        where a.clinica_id = c and a.status = 'finalizado'
          and not exists (select 1 from public.evolucoes e where e.agendamento_id = a.id)),
      'faltas_justificadas_sem_atestado', (
        select count(*) from public.agendamentos a
        where a.clinica_id = c and a.status = 'falta_justificada'
          and not exists (select 1 from public.paciente_documentos d where d.agendamento_id = a.id and d.excluido_em is null)),
      'excluidos', jsonb_build_object(
        'guias', (select count(*) from public.guias_convenio where clinica_id = c and excluido_em is not null),
        'glosas', (select count(*) from public.glosas where clinica_id = c and excluido_em is not null),
        'documentos', (select count(*) from public.paciente_documentos where clinica_id = c and excluido_em is not null),
        'relatorios', (select count(*) from public.relatorios_liberados where clinica_id = c and excluido_em is not null)),
      'adendos', (select count(*) from public.evolucao_adendos where clinica_id = c)),
    'gerado_em', now()
  ) into r;
  return r;
end $$;
revoke execute on function public.painel_governanca() from public, anon;
grant execute on function public.painel_governanca() to authenticated, service_role;
