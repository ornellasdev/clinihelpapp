-- =====================================================================
-- Etapa 1 · Pilares 3, 4 e 1.4 — Menor privilégio, auditoria imutável e views de indicadores
-- =====================================================================

-- ---------- PILAR 3: menor privilégio por papel ----------
-- Pacientes: terapeuta só vê os próprios pacientes
drop policy if exists "le pacientes" on public.pacientes;
create policy "le pacientes" on public.pacientes for select to authenticated
  using (clinica_id = (select public.minha_clinica()) and public.is_staff(auth.uid()) and public.pode_ver_paciente(id));

-- Agenda: gestão/recepção/financeiro veem a agenda da clínica; terapeuta só a própria
drop policy if exists "le agenda" on public.agendamentos;
create policy "le agenda" on public.agendamentos for select to authenticated
  using (clinica_id = (select public.minha_clinica()) and public.is_staff(auth.uid())
         and (public.ve_cadastro_completo(auth.uid()) or profissional_id = auth.uid()));

-- Lista de espera: terapeuta vê só pedidos da especialidade dele ou endereçados a ele
drop policy if exists "equipe le lista de espera" on public.lista_espera;
create policy "equipe le lista de espera" on public.lista_espera for select to authenticated
  using (clinica_id = (select public.minha_clinica()) and public.is_staff(auth.uid())
         and (public.ve_cadastro_completo(auth.uid()) or profissional_id = auth.uid()
              or public.has_especialidade(auth.uid(), especialidade_id)));

-- Documentos: laudos/relatórios/exames/receitas só para master e terapeuta do paciente;
-- demais (atestado, documentos pessoais, termos...) para quem vê o paciente; quem enviou sempre vê o que enviou
drop policy if exists "le documentos" on public.paciente_documentos;
create policy "le documentos" on public.paciente_documentos for select to authenticated
  using (clinica_id = (select public.minha_clinica()) and public.is_staff(auth.uid())
         and public.pode_ver_documento(categoria, paciente_id, enviado_por));

drop policy if exists "le arquivos da clinica" on storage.objects;
create policy "le arquivos da clinica" on storage.objects for select to authenticated
  using (bucket_id = 'documentos-pacientes'
         and (storage.foldername(name))[1] = (select public.minha_clinica())::text
         and public.is_staff(auth.uid())
         and (owner = auth.uid() or public.pode_ler_arquivo_documento(name)));

-- Termos assinados (com CPF de quem assinou): só quem vê o paciente
drop policy if exists "equipe le termos" on public.termos_assinaturas;
create policy "equipe le termos" on public.termos_assinaturas for select to authenticated
  using (clinica_id = (select public.minha_clinica()) and public.is_staff(auth.uid()) and public.pode_ver_paciente(paciente_id));

-- ---------- PILAR 4: trilha de auditoria imutável ----------
create or replace function public.auditar_alteracao()
 returns trigger language plpgsql security definer set search_path to 'public' as $function$
declare
  uid uuid := auth.uid();
  v_old jsonb; v_new jsonb; rec jsonb;
  k text; v_campos text[]; v_antes jsonb := '{}'; v_depois jsonb := '{}';
  v_desc text; v_pac text; v_nome text;
  v_acao text := case TG_OP when 'INSERT' then 'criou' when 'UPDATE' then 'alterou' else 'removeu' end;
begin
  -- Ações de equipe/cobrança feitas pelo servidor já são registradas por auditoria.server.ts
  if uid is null and TG_TABLE_NAME in ('profiles', 'user_roles', 'profissional_especialidades', 'profissional_config', 'cobrancas', 'atendimento_financeiro') then
    return coalesce(new, old);
  end if;
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
    -- exclusão lógica aparece como "removeu"
    if (v_new ->> 'excluido_em') is not null and (v_old ->> 'excluido_em') is null then
      v_acao := 'removeu';
    end if;
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
    when 'evolucao_adendos' then concat_ws(' · ', v_pac, 'Adendo', (select nome from public.especialidades where id = (rec ->> 'especialidade_id')::uuid))
    when 'paciente_dados_clinicos' then concat_ws(' · ', v_pac, 'Dados clínicos')
    when 'paciente_documentos' then concat_ws(' · ', rec ->> 'nome', v_pac)
    when 'atendimento_financeiro' then (
      select concat_ws(' · ', p.nome, to_char(a.inicio at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI'))
      from public.agendamentos a join public.pacientes p on p.id = a.paciente_id
      where a.id = (rec ->> 'agendamento_id')::uuid)
    when 'liberacoes_atendimento' then (
      select concat_ws(' · ', p.nome, to_char(a.inicio at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI'))
      from public.agendamentos a join public.pacientes p on p.id = a.paciente_id
      where a.id = (rec ->> 'agendamento_id')::uuid)
    when 'cobranca_itens' then (
      select concat_ws(' · ', p.nome, to_char(a.inicio at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI'))
      from public.agendamentos a join public.pacientes p on p.id = a.paciente_id
      where a.id = (rec ->> 'agendamento_id')::uuid)
    when 'fatura_liminar_itens' then (
      select concat_ws(' · ', p.nome, to_char(a.inicio at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI'))
      from public.agendamentos a join public.pacientes p on p.id = a.paciente_id
      where a.id = (rec ->> 'agendamento_id')::uuid)
    when 'guias_convenio' then concat_ws(' · ', v_pac, 'Guia ' || (rec ->> 'codigo_guia'))
    when 'glosas' then concat_ws(' · ', v_pac, (select nome from public.convenios where id = (rec ->> 'convenio_id')::uuid))
    when 'termos_assinaturas' then concat_ws(' · ', v_pac, rec ->> 'titulo')
    when 'user_roles' then concat_ws(' · ', (select nome from public.profiles where id = (rec ->> 'user_id')::uuid), rec ->> 'role')
    when 'profissional_especialidades' then concat_ws(' · ',
      (select nome from public.profiles where id = (rec ->> 'user_id')::uuid),
      (select nome from public.especialidades where id = (rec ->> 'especialidade_id')::uuid))
    when 'profissional_config' then (select nome from public.profiles where id = (rec ->> 'user_id')::uuid)
    when 'convenio_valores' then (select nome from public.convenios where id = (rec ->> 'convenio_id')::uuid)
    else coalesce(rec ->> 'nome', v_pac)
  end;

  v_nome := case
    when uid is not null then public.nome_auditoria()
    when TG_TABLE_NAME = 'termos_assinaturas' and (rec ->> 'assinante_nome') is not null then 'Família · ' || (rec ->> 'assinante_nome')
    else 'Sistema CliniHelp' end;

  insert into public.auditoria (clinica_id, usuario_id, usuario_nome, acao, tabela, registro_id, descricao, campos, antes, depois)
  values (
    coalesce((rec ->> 'clinica_id')::uuid, public.minha_clinica()),
    uid, v_nome, v_acao, TG_TABLE_NAME,
    coalesce(rec ->> 'id', rec ->> 'agendamento_id', rec ->> 'convenio_id', rec ->> 'user_id', rec ->> 'paciente_id'),
    v_desc, v_campos, v_antes, v_depois
  );
  return coalesce(new, old);
end; $function$;

create trigger auditoria_paciente_dados_clinicos after insert or update or delete on public.paciente_dados_clinicos
  for each row execute function public.auditar_alteracao();
create trigger auditoria_evolucao_adendos after insert or update or delete on public.evolucao_adendos
  for each row execute function public.auditar_alteracao();
create trigger auditoria_cobranca_itens after insert or update or delete on public.cobranca_itens
  for each row execute function public.auditar_alteracao();
create trigger auditoria_fatura_liminar_itens after insert or update or delete on public.fatura_liminar_itens
  for each row execute function public.auditar_alteracao();

-- Somente inclusão: ninguém altera, apaga ou esvazia a trilha (nem o servidor)
create or replace function public.auditoria_somente_inclusao()
returns trigger language plpgsql set search_path = public as $$
begin
  raise exception 'A trilha de auditoria não pode ser alterada nem apagada.' using errcode = '42501';
end $$;
create trigger trg_auditoria_imutavel before update or delete on public.auditoria
  for each row execute function public.auditoria_somente_inclusao();
create trigger trg_auditoria_sem_truncate before truncate on public.auditoria
  for each statement execute function public.auditoria_somente_inclusao();
revoke update, delete, truncate on public.auditoria from anon, authenticated, service_role;

-- Prontuário, adendos e dados clínicos na auditoria: só master
drop policy if exists "gestor le auditoria" on public.auditoria;
create policy "gestor le auditoria" on public.auditoria for select to authenticated
  using (clinica_id = (select public.minha_clinica())
         and (public.has_role(auth.uid(), 'master')
              or (public.is_gestor(auth.uid())
                  and tabela <> all (array['evolucoes', 'plano_metas', 'evolucao_metas', 'evolucao_adendos', 'paciente_dados_clinicos']))));

-- Nome padrão de mercado para a mesma trilha (somente leitura, respeita as regras acima)
create view public.audit_logs with (security_invoker = true) as
  select id, created_at, clinica_id,
         usuario_id as user_id, usuario_nome as user_name,
         acao as action, tabela as table_name, registro_id as record_id,
         campos as changed_fields, antes as old_data, depois as new_data, descricao as description
  from public.auditoria;
grant select on public.audit_logs to authenticated;
grant select on public.audit_logs to service_role;

-- ---------- PILAR 1.4: views de indicadores (respeitam as regras de acesso de quem consulta) ----------
create view public.vw_kpi_sessoes_mes with (security_invoker = true) as
  select a.clinica_id,
         date_trunc('month', a.inicio at time zone 'America/Sao_Paulo')::date as mes,
         a.especialidade_id, a.profissional_id, a.sala_id,
         count(*)::int as total,
         count(*) filter (where a.status = 'finalizado')::int as finalizadas,
         count(*) filter (where a.status = 'falta_justificada')::int as faltas_justificadas,
         count(*) filter (where a.status = 'falta_terapeuta')::int as faltas_terapeuta,
         count(*) filter (where a.status = 'falta_cobrada')::int as faltas_cobradas,
         count(*) filter (where a.status = 'cancelado')::int as canceladas,
         round(sum(extract(epoch from (a.fim - a.inicio)) / 3600.0) filter (where a.status <> 'cancelado'), 2) as horas_reservadas
  from public.agendamentos a
  group by 1, 2, 3, 4, 5;

create view public.vw_kpi_financeiro_mes with (security_invoker = true) as
  select a.clinica_id,
         date_trunc('month', a.inicio at time zone 'America/Sao_Paulo')::date as mes,
         a.profissional_id, a.especialidade_id,
         count(*) filter (where f.cobrar)::int as sessoes_cobradas,
         coalesce(sum(f.valor) filter (where f.cobrar), 0) as faturado,
         coalesce(sum(f.valor) filter (where f.cobrar and f.pagamento_status = 'pago'), 0) as recebido,
         coalesce(sum(f.valor) filter (where f.cobrar and f.pagamento_status <> 'pago'), 0) as a_receber,
         coalesce(sum(round(f.valor * f.percentual_repasse / 100.0, 2)) filter (where f.cobrar and f.repassar), 0) as repasse_devido,
         coalesce(sum(round(f.valor * f.percentual_repasse / 100.0, 2)) filter (where f.cobrar and f.repassar and f.repasse_pago), 0) as repasse_pago
  from public.agendamentos a
  join public.atendimento_financeiro f on f.agendamento_id = a.id
  where a.status::text in ('finalizado', 'falta_cobrada')
  group by 1, 2, 3, 4;

create view public.vw_kpi_glosas with (security_invoker = true) as
  select g.clinica_id, g.convenio_id, g.status,
         date_trunc('month', g.data_glosa)::date as mes,
         count(*)::int as quantidade, sum(g.valor) as valor
  from public.glosas g
  where g.excluido_em is null
  group by 1, 2, 3, 4;

create view public.vw_conformidade_lgpd with (security_invoker = true) as
  select p.clinica_id,
         count(*) filter (where p.ativo)::int as pacientes_ativos,
         count(*) filter (where p.ativo and p.lgpd_consentimento_status = 'assinado')::int as com_consentimento,
         count(*) filter (where p.ativo and p.lgpd_consentimento_status = 'pendente')::int as sem_consentimento,
         count(*) filter (where p.ativo and p.lgpd_consentimento_status = 'revogado')::int as consentimento_revogado
  from public.pacientes p
  group by 1;

grant select on public.vw_kpi_sessoes_mes, public.vw_kpi_financeiro_mes, public.vw_kpi_glosas, public.vw_conformidade_lgpd to authenticated;
grant select on public.vw_kpi_sessoes_mes, public.vw_kpi_financeiro_mes, public.vw_kpi_glosas, public.vw_conformidade_lgpd to service_role;
