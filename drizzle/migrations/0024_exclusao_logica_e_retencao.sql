-- =====================================================================
-- Etapa 1 · Pilar 1.3 — Exclusão lógica (soft delete) e retenção
-- Registros clínicos, guias e financeiros não são apagados fisicamente.
-- =====================================================================

-- 1) Colunas de exclusão lógica
alter table public.guias_convenio       add column if not exists excluido_em timestamptz, add column if not exists excluido_por uuid;
alter table public.glosas               add column if not exists excluido_em timestamptz, add column if not exists excluido_por uuid;
alter table public.paciente_documentos  add column if not exists excluido_em timestamptz, add column if not exists excluido_por uuid;
alter table public.relatorios_liberados add column if not exists excluido_em timestamptz, add column if not exists excluido_por uuid;

-- 2) DELETE vira marcação de exclusão (o pedido de exclusão continua passando pela regra de quem pode excluir)
create or replace function public.exclusao_logica()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform set_config('clinihelp.exclusao_logica', 'on', true);
  execute format('update public.%I set excluido_em = now(), excluido_por = auth.uid() where id = $1 and excluido_em is null', TG_TABLE_NAME)
    using old.id;
  if TG_TABLE_NAME = 'guias_convenio' then
    -- sessões ainda não realizadas deixam de usar a guia excluída; as finalizadas mantêm o vínculo histórico
    update public.liberacoes_atendimento l set guia_id = null
    from public.agendamentos a
    where l.guia_id = old.id and a.id = l.agendamento_id and a.status::text <> 'finalizado';
  end if;
  perform set_config('clinihelp.exclusao_logica', 'off', true);
  return null; -- cancela o DELETE físico
end $$;

-- 3) Ninguém marca/desmarca exclusão por fora (nem "ressuscita" registro)
create or replace function public.proteger_exclusao_logica()
returns trigger language plpgsql set search_path = public as $$
begin
  if (new.excluido_em is distinct from old.excluido_em or new.excluido_por is distinct from old.excluido_por)
     and coalesce(current_setting('clinihelp.exclusao_logica', true), 'off') <> 'on' then
    raise exception 'A exclusão de registros é feita apenas pelo botão Excluir e não pode ser desfeita.' using errcode = '42501';
  end if;
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['guias_convenio','glosas','paciente_documentos','relatorios_liberados'] loop
    execute format('create trigger trg_%s_exclusao_logica before delete on public.%I for each row execute function public.exclusao_logica()', t, t);
    execute format('create trigger trg_%s_protege_exclusao before update on public.%I for each row execute function public.proteger_exclusao_logica()', t, t);
    execute format('create policy "oculta registros excluidos" on public.%I as restrictive for select to authenticated using (excluido_em is null)', t);
  end loop;
end $$;

-- 4) Paciente: "excluir" vira inativar (ficha preservada)
create or replace function public.paciente_inativar_no_delete()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.pacientes set ativo = false where id = old.id;
  return null;
end $$;
create trigger trg_pacientes_inativar before delete on public.pacientes
  for each row execute function public.paciente_inativar_no_delete();

-- 5) Evolução do prontuário nunca é apagada (correções serão por adendo)
create or replace function public.bloquear_exclusao_evolucao()
returns trigger language plpgsql set search_path = public as $$
begin
  raise exception 'Evoluções do prontuário não podem ser apagadas. Para corrigir, registre um adendo.' using errcode = '42501';
end $$;
create trigger trg_evolucoes_sem_exclusao before delete on public.evolucoes
  for each row execute function public.bloquear_exclusao_evolucao();

-- 6) Agendamento só pode ser excluído se nunca aconteceu nada com ele
create or replace function public.proteger_exclusao_agendamento()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.status::text not in ('agendado', 'cancelado') then
    raise exception 'Este atendimento já tem histórico (chegada, atendimento ou falta) e não pode ser excluído. Use Cancelar.' using errcode = '42501';
  end if;
  if exists (select 1 from public.atendimento_financeiro f
             where f.agendamento_id = old.id and (f.pagamento_status = 'pago' or f.repasse_pago)) then
    raise exception 'Este atendimento tem pagamento ou repasse registrado e não pode ser excluído. Use Cancelar.' using errcode = '42501';
  end if;
  return old;
end $$;
create trigger trg_agendamentos_protege_exclusao before delete on public.agendamentos
  for each row execute function public.proteger_exclusao_agendamento();

-- 7) Guias: a sessão só usa guia não excluída
create or replace function public.vincular_guia_sessao()
 returns trigger language plpgsql security definer set search_path to 'public' as $function$
declare v_guia uuid; v_dia date;
begin
  if new.status::text not in ('aguardando', 'em_atendimento', 'finalizado') then return new; end if;
  if exists (select 1 from liberacoes_atendimento where agendamento_id = new.id and guia_id is not null) then return new; end if;
  v_dia := (new.inicio at time zone 'America/Sao_Paulo')::date;
  select g.id into v_guia from guias_convenio g
  where g.clinica_id = new.clinica_id and g.paciente_id = new.paciente_id and g.especialidade_id = new.especialidade_id
    and g.status = 'autorizada' and g.validade >= v_dia and g.excluido_em is null
    and g.sessoes_autorizadas > (
      select count(*) from liberacoes_atendimento l join agendamentos a on a.id = l.agendamento_id
      where l.guia_id = g.id and a.status::text in ('aguardando', 'em_atendimento', 'finalizado') and a.id <> new.id)
  order by g.validade, g.created_at
  limit 1;
  if v_guia is null then return new; end if;
  insert into liberacoes_atendimento (agendamento_id, clinica_id, guia_id) values (new.id, new.clinica_id, v_guia)
  on conflict (agendamento_id) do update set guia_id = excluded.guia_id;
  return new;
end $function$;

-- 8) Relatório revogado some da área dos pais
create or replace function public.familia_relatorios(_paciente uuid)
 returns table(id uuid, titulo text, finalidade text, periodo_de date, periodo_ate date, created_at timestamp with time zone)
 language sql stable security definer set search_path to 'public' as $function$
  select r.id, r.titulo, r.finalidade, r.periodo_de, r.periodo_ate, r.created_at
  from public.relatorios_liberados r
  where public.responsavel_de(_paciente) and r.paciente_id = _paciente and r.excluido_em is null
  order by r.created_at desc
$function$;

-- 9) Arquivos: só some do armazenamento um envio recente e sem vínculo (ex.: envio que falhou).
--    Arquivo ligado a um registro (mesmo excluído) é preservado.
create or replace function public.arquivo_referenciado(_bucket text, _path text)
returns boolean language sql stable security definer set search_path = public as $$
  select case _bucket
    when 'documentos-pacientes' then exists (select 1 from public.paciente_documentos where storage_path = _path)
    when 'guias-convenio'       then exists (select 1 from public.guias_convenio where anexo_path = _path)
    when 'relatorios-familia'   then exists (select 1 from public.relatorios_liberados where storage_path = _path)
    else false end
$$;

drop policy if exists "remove arquivos da clinica" on storage.objects;
drop policy if exists "equipe de guias remove anexos" on storage.objects;
drop policy if exists "clinico remove relatorio liberado" on storage.objects;

create policy "desfaz envio de documento" on storage.objects for delete to authenticated using (
  bucket_id = 'documentos-pacientes'
  and (storage.foldername(name))[1] = (select public.minha_clinica())::text
  and owner = auth.uid() and created_at > now() - interval '15 minutes'
  and not public.arquivo_referenciado(bucket_id, name));
create policy "desfaz envio de anexo de guia" on storage.objects for delete to authenticated using (
  bucket_id = 'guias-convenio'
  and (storage.foldername(name))[1] = (select public.minha_clinica())::text
  and owner = auth.uid() and created_at > now() - interval '15 minutes'
  and not public.arquivo_referenciado(bucket_id, name));
create policy "desfaz envio de relatorio" on storage.objects for delete to authenticated using (
  bucket_id = 'relatorios-familia'
  and (storage.foldername(name))[1] = (select public.minha_clinica())::text
  and owner = auth.uid() and created_at > now() - interval '15 minutes'
  and not public.arquivo_referenciado(bucket_id, name));
