-- Adendos são somente inclusão; dados clínicos não são apagados pela interface.
revoke update, delete, truncate on public.evolucao_adendos from anon, authenticated;
revoke delete, truncate on public.paciente_dados_clinicos from anon, authenticated;
revoke all on public.evolucao_adendos from anon;
revoke all on public.paciente_dados_clinicos from anon;
revoke all on public.audit_logs from anon;
revoke all on public.vw_kpi_sessoes_mes, public.vw_kpi_financeiro_mes, public.vw_kpi_glosas, public.vw_conformidade_lgpd from anon;
