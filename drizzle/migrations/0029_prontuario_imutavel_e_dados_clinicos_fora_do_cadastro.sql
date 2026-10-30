-- =====================================================================
-- Etapa 2 — Prontuário imutável (correção só por adendo) e ePHI fora do cadastro
-- =====================================================================

-- 1) Evolução registrada não muda mais (o texto, a data e o vínculo ficam como foram assinados)
alter table public.evolucoes add constraint evolucoes_conteudo_check
  check (char_length(btrim(conteudo)) between 1 and 20000) not valid;

create or replace function public.bloquear_alteracao_evolucao()
returns trigger language plpgsql set search_path = public as $$
begin
  raise exception 'Evolução registrada não pode ser alterada. Para corrigir ou complementar, registre um adendo.' using errcode = '42501';
end $$;
create trigger trg_evolucoes_imutavel before update on public.evolucoes
  for each row execute function public.bloquear_alteracao_evolucao();
drop policy if exists "autor edita evolucao" on public.evolucoes;
revoke update on public.evolucoes from anon, authenticated;

-- 2) Progresso das metas só é gravado junto com a evolução (mesma transação)
create or replace function public.progresso_junto_da_evolucao()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.evolucoes
                 where id = coalesce(new.evolucao_id, old.evolucao_id) and created_at = now()) then
    raise exception 'O progresso das metas é registrado junto com a evolução e não pode ser alterado depois. Registre um adendo.' using errcode = '42501';
  end if;
  return coalesce(new, old);
end $$;
create trigger trg_evolucao_metas_junto before insert or update or delete on public.evolucao_metas
  for each row execute function public.progresso_junto_da_evolucao();

-- 3) Registrar evolução + progresso das metas numa única operação (respeita as regras de acesso de quem chama)
create or replace function public.registrar_evolucao(
  _paciente uuid, _especialidade uuid, _data date, _conteudo text,
  _agendamento uuid default null, _metas jsonb default '[]'::jsonb)
returns uuid language plpgsql security invoker set search_path = public as $$
declare v_id uuid; m jsonb;
begin
  if _conteudo is null or char_length(btrim(_conteudo)) = 0 then raise exception 'Escreva a evolução.'; end if;
  if _data > (now() at time zone 'America/Sao_Paulo')::date then raise exception 'A data do atendimento não pode ser no futuro.'; end if;
  insert into public.evolucoes (paciente_id, especialidade_id, data_atendimento, conteudo, agendamento_id)
  values (_paciente, _especialidade, _data, btrim(_conteudo), _agendamento)
  returning id into v_id;
  for m in select * from jsonb_array_elements(coalesce(_metas, '[]'::jsonb)) loop
    insert into public.evolucao_metas (evolucao_id, meta_id, paciente_id, especialidade_id, nivel)
    values (v_id, (m ->> 'meta_id')::uuid, _paciente, _especialidade, (m ->> 'nivel')::smallint);
  end loop;
  return v_id;
end $$;
revoke execute on function public.registrar_evolucao(uuid, uuid, date, text, uuid, jsonb) from public, anon;
grant execute on function public.registrar_evolucao(uuid, uuid, date, text, uuid, jsonb) to authenticated, service_role;

-- 4) Diagnóstico, CID, alergias e medicação não ficam mais no cadastro administrativo.
--    Se alguma versão antiga da tela ainda enviar, o valor vai para paciente_dados_clinicos e o cadastro fica vazio.
drop trigger if exists trg_pacientes_copia_dados_clinicos on public.pacientes;

create or replace function public.mover_dados_clinicos_paciente()
returns trigger language plpgsql security definer set search_path = public as $$
declare v jsonb;
begin
  if coalesce(new.diagnostico, new.cid, new.alergias, new.medicamentos) is null then return new; end if;
  v := jsonb_build_object('diagnostico', new.diagnostico, 'cid', new.cid, 'alergias', new.alergias, 'medicamentos', new.medicamentos);
  new.diagnostico := null; new.cid := null; new.alergias := null; new.medicamentos := null;
  if tg_op = 'UPDATE' then
    insert into public.paciente_dados_clinicos (paciente_id, clinica_id, diagnostico, cid, alergias, medicamentos)
    values (new.id, new.clinica_id, v ->> 'diagnostico', v ->> 'cid', v ->> 'alergias', v ->> 'medicamentos')
    on conflict (paciente_id) do update set
      diagnostico = excluded.diagnostico, cid = excluded.cid, alergias = excluded.alergias, medicamentos = excluded.medicamentos;
  else
    perform set_config('clinihelp.dc_' || replace(new.id::text, '-', '_'), v::text, true);
  end if;
  return new;
end $$;

create or replace function public.gravar_dados_clinicos_paciente_novo()
returns trigger language plpgsql security definer set search_path = public as $$
declare k text := 'clinihelp.dc_' || replace(new.id::text, '-', '_'); v jsonb;
begin
  v := nullif(current_setting(k, true), '')::jsonb;
  if v is null then return null; end if;
  insert into public.paciente_dados_clinicos (paciente_id, clinica_id, diagnostico, cid, alergias, medicamentos)
  values (new.id, new.clinica_id, v ->> 'diagnostico', v ->> 'cid', v ->> 'alergias', v ->> 'medicamentos')
  on conflict (paciente_id) do nothing;
  perform set_config(k, '', true);
  return null;
end $$;

create trigger trg_pacientes_move_dados_clinicos before insert or update on public.pacientes
  for each row execute function public.mover_dados_clinicos_paciente();
create trigger trg_pacientes_grava_dados_clinicos after insert on public.pacientes
  for each row execute function public.gravar_dados_clinicos_paciente_novo();

-- backfill: o que ainda estiver no cadastro já foi copiado; garante a cópia e esvazia o cadastro
insert into public.paciente_dados_clinicos (paciente_id, clinica_id, diagnostico, cid, alergias, medicamentos)
select id, clinica_id, diagnostico, cid, alergias, medicamentos from public.pacientes
where coalesce(diagnostico, cid, alergias, medicamentos) is not null
on conflict (paciente_id) do update set
  diagnostico = coalesce(excluded.diagnostico, paciente_dados_clinicos.diagnostico),
  cid = coalesce(excluded.cid, paciente_dados_clinicos.cid),
  alergias = coalesce(excluded.alergias, paciente_dados_clinicos.alergias),
  medicamentos = coalesce(excluded.medicamentos, paciente_dados_clinicos.medicamentos);
update public.pacientes set diagnostico = null, cid = null, alergias = null, medicamentos = null
where coalesce(diagnostico, cid, alergias, medicamentos) is not null;

comment on column public.pacientes.diagnostico is 'DEPRECATED: replaced by paciente_dados_clinicos.diagnostico (always null here).';
comment on column public.pacientes.cid is 'DEPRECATED: replaced by paciente_dados_clinicos.cid (always null here).';
comment on column public.pacientes.alergias is 'DEPRECATED: replaced by paciente_dados_clinicos.alergias (always null here).';
comment on column public.pacientes.medicamentos is 'DEPRECATED: replaced by paciente_dados_clinicos.medicamentos (always null here).';

-- 5) Saída automática por inatividade fica registrada na auditoria
create or replace function public.registrar_acesso(_acao text)
 returns void language plpgsql security definer set search_path to 'public' as $function$
begin
  if auth.uid() is null then raise exception 'Sessão inválida'; end if;
  if _acao not in ('login', 'logout', 'logout_inatividade') then raise exception 'Ação inválida'; end if;
  if public.minha_clinica() is null then return; end if;
  insert into public.auditoria (clinica_id, usuario_id, usuario_nome, acao, tabela)
  values (public.minha_clinica(), auth.uid(), public.nome_auditoria(), _acao, 'acesso');
end; $function$;
