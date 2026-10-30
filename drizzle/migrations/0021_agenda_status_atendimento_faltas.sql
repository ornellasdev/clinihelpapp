-- Nova máquina de status da agenda.
-- Comparações com os status novos usam ::text para a migração rodar na mesma transação do ADD VALUE.
ALTER TYPE public.agendamento_status RENAME VALUE 'confirmado' TO 'aguardando';
ALTER TYPE public.agendamento_status RENAME VALUE 'realizado' TO 'finalizado';
ALTER TYPE public.agendamento_status RENAME VALUE 'falta' TO 'falta_cobrada';
ALTER TYPE public.agendamento_status ADD VALUE IF NOT EXISTS 'em_atendimento' AFTER 'aguardando';
ALTER TYPE public.agendamento_status ADD VALUE IF NOT EXISTS 'falta_justificada' AFTER 'finalizado';
ALTER TYPE public.agendamento_status ADD VALUE IF NOT EXISTS 'falta_terapeuta' AFTER 'falta_justificada';

ALTER TABLE public.agendamentos
  ADD COLUMN IF NOT EXISTS chegada_em timestamptz,
  ADD COLUMN IF NOT EXISTS atendimento_iniciado_em timestamptz,
  ADD COLUMN IF NOT EXISTS finalizado_em timestamptz,
  ADD COLUMN IF NOT EXISTS falta_motivo text,
  ADD COLUMN IF NOT EXISTS falta_repasse boolean,
  ADD COLUMN IF NOT EXISTS reposicao_pendente boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.agendamentos.falta_repasse IS 'Falta não justificada (cobrada): se o profissional recebe repasse pela hora reservada.';
COMMENT ON COLUMN public.agendamentos.reposicao_pendente IS 'Falta do terapeuta: sessão precisa ser reposta.';

-- Regra financeira gravada por sessão (mantida pelo gatilho a partir do status).
ALTER TABLE public.atendimento_financeiro
  ADD COLUMN IF NOT EXISTS cobrar boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS repassar boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.atendimento_financeiro.cobrar IS 'Falso nas faltas não cobradas (justificada / do terapeuta) e cancelamentos.';
COMMENT ON COLUMN public.atendimento_financeiro.repassar IS 'Falso quando a sessão não gera repasse ao profissional.';

-- Atestado / comprovante ligado à sessão.
ALTER TABLE public.paciente_documentos
  ADD COLUMN IF NOT EXISTS agendamento_id uuid REFERENCES public.agendamentos(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS paciente_documentos_agendamento_idx ON public.paciente_documentos (agendamento_id) WHERE agendamento_id IS NOT NULL;

-- Carimbos de horário de cada etapa do atendimento.
CREATE OR REPLACE FUNCTION public.agendamento_status_carimbo()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
declare s text := new.status::text;
begin
  if TG_OP = 'UPDATE' and new.status is not distinct from old.status
     and new.falta_repasse is not distinct from old.falta_repasse then
    return new;
  end if;
  if s = 'agendado' then
    new.chegada_em := null; new.atendimento_iniciado_em := null;
  elsif s = 'aguardando' then
    new.chegada_em := coalesce(new.chegada_em, now()); new.atendimento_iniciado_em := null;
  elsif s = 'em_atendimento' then
    new.chegada_em := coalesce(new.chegada_em, now());
    new.atendimento_iniciado_em := coalesce(new.atendimento_iniciado_em, now());
  end if;
  if s = 'finalizado' then
    new.finalizado_em := coalesce(new.finalizado_em, now());
  else
    new.finalizado_em := null;
  end if;
  if s <> 'falta_cobrada' then new.falta_repasse := null;
  elsif new.falta_repasse is null then new.falta_repasse := true;
  end if;
  if s <> 'falta_terapeuta' then new.reposicao_pendente := false; end if;
  return new;
end $$;

DROP TRIGGER IF EXISTS trg_agend_status_carimbo ON public.agendamentos;
CREATE TRIGGER trg_agend_status_carimbo BEFORE INSERT OR UPDATE ON public.agendamentos
  FOR EACH ROW EXECUTE FUNCTION public.agendamento_status_carimbo();

-- Cobrança e repasse seguem o status. Mesma regra de regraFinanceira em src/lib/agenda-status.ts.
CREATE OR REPLACE FUNCTION public.sincronizar_financeiro_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare s text := new.status::text; v_cobrar boolean; v_repassar boolean;
begin
  if TG_OP = 'UPDATE' and new.status is not distinct from old.status
     and new.falta_repasse is not distinct from old.falta_repasse then
    return null;
  end if;
  v_cobrar := s not in ('falta_justificada', 'falta_terapeuta', 'cancelado');
  v_repassar := v_cobrar and (s <> 'falta_cobrada' or coalesce(new.falta_repasse, true));
  update atendimento_financeiro set cobrar = v_cobrar, repassar = v_repassar
  where agendamento_id = new.id and (cobrar is distinct from v_cobrar or repassar is distinct from v_repassar);
  return null;
end $$;

DROP TRIGGER IF EXISTS trg_agend_financeiro_status ON public.agendamentos;
CREATE TRIGGER trg_agend_financeiro_status AFTER INSERT OR UPDATE OF status, falta_repasse ON public.agendamentos
  FOR EACH ROW EXECUTE FUNCTION public.sincronizar_financeiro_status();

-- Evolução salva e vinculada à sessão => sessão finalizada.
CREATE OR REPLACE FUNCTION public.finalizar_sessao_pela_evolucao()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
begin
  if new.agendamento_id is null then return null; end if;
  if TG_OP = 'UPDATE' and new.agendamento_id is not distinct from old.agendamento_id then return null; end if;
  update agendamentos set status = 'finalizado'
  where id = new.agendamento_id and clinica_id = new.clinica_id
    and paciente_id = new.paciente_id and especialidade_id = new.especialidade_id
    and status::text in ('agendado', 'aguardando', 'em_atendimento');
  return null;
end $$;

DROP TRIGGER IF EXISTS trg_evolucao_finaliza_sessao ON public.evolucoes;
CREATE TRIGGER trg_evolucao_finaliza_sessao AFTER INSERT OR UPDATE OF agendamento_id ON public.evolucoes
  FOR EACH ROW EXECUTE FUNCTION public.finalizar_sessao_pela_evolucao();

-- Guia: vincula na chegada (token validado); só a sessão finalizada desconta o saldo.
CREATE OR REPLACE FUNCTION public.vincular_guia_sessao()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare v_guia uuid; v_dia date;
begin
  if new.status::text not in ('aguardando', 'em_atendimento', 'finalizado') then return new; end if;
  if exists (select 1 from liberacoes_atendimento where agendamento_id = new.id and guia_id is not null) then return new; end if;
  v_dia := (new.inicio at time zone 'America/Sao_Paulo')::date;
  select g.id into v_guia from guias_convenio g
  where g.clinica_id = new.clinica_id and g.paciente_id = new.paciente_id and g.especialidade_id = new.especialidade_id
    and g.status = 'autorizada' and g.validade >= v_dia
    and g.sessoes_autorizadas > (
      select count(*) from liberacoes_atendimento l join agendamentos a on a.id = l.agendamento_id
      where l.guia_id = g.id and a.status::text in ('aguardando', 'em_atendimento', 'finalizado') and a.id <> new.id)
  order by g.validade, g.created_at
  limit 1;
  if v_guia is null then return new; end if;
  insert into liberacoes_atendimento (agendamento_id, clinica_id, guia_id) values (new.id, new.clinica_id, v_guia)
  on conflict (agendamento_id) do update set guia_id = excluded.guia_id;
  return new;
end $$;

CREATE OR REPLACE VIEW public.guias_uso WITH (security_invoker = true) AS
  SELECT l.guia_id,
    (count(*) FILTER (WHERE a.status::text = 'finalizado'))::int AS usadas,
    (count(*) FILTER (WHERE a.status::text IN ('agendado', 'aguardando', 'em_atendimento')))::int AS reservadas
  FROM public.liberacoes_atendimento l
  JOIN public.agendamentos a ON a.id = l.agendamento_id
  WHERE l.guia_id IS NOT NULL
  GROUP BY l.guia_id;

-- Mesma clínica: atestado ligado a sessão do mesmo paciente; liminar só com sessão finalizada.
CREATE OR REPLACE FUNCTION public.garantir_mesma_clinica()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
    ok := exists (select 1 from pacientes where id = new.paciente_id and clinica_id = new.clinica_id)
      and (new.agendamento_id is null or exists (
        select 1 from agendamentos where id = new.agendamento_id and clinica_id = new.clinica_id and paciente_id = new.paciente_id));
  elsif TG_TABLE_NAME = 'relatorios_liberados' then
    ok := exists (select 1 from pacientes where id = new.paciente_id and clinica_id = new.clinica_id);
  elsif TG_TABLE_NAME = 'termos_assinaturas' then
    ok := exists (select 1 from pacientes where id = new.paciente_id and clinica_id = new.clinica_id)
      and (new.modelo_id is null or exists (select 1 from termos_modelos where id = new.modelo_id and clinica_id = new.clinica_id));
  elsif TG_TABLE_NAME = 'pacientes' then
    ok := new.convenio_id is null or exists (select 1 from convenios where id = new.convenio_id and clinica_id = new.clinica_id);
  elsif TG_TABLE_NAME = 'convenio_valores' then
    ok := exists (select 1 from convenios where id = new.convenio_id and clinica_id = new.clinica_id);
  elsif TG_TABLE_NAME in ('user_roles', 'profissional_config') then
    ok := exists (select 1 from profiles where id = new.user_id and clinica_id = new.clinica_id);
  elsif TG_TABLE_NAME = 'profissional_especialidades' then
    ok := exists (select 1 from profiles where id = new.user_id and clinica_id = new.clinica_id)
      and exists (select 1 from especialidades where id = new.especialidade_id and clinica_id = new.clinica_id);
  elsif TG_TABLE_NAME = 'cobrancas' then
    ok := exists (select 1 from pacientes where id = new.paciente_id and clinica_id = new.clinica_id);
  elsif TG_TABLE_NAME = 'cobranca_itens' then
    ok := exists (select 1 from cobrancas where id = new.cobranca_id and clinica_id = new.clinica_id)
      and exists (select 1 from agendamentos a join cobrancas c on c.id = new.cobranca_id
                  where a.id = new.agendamento_id and a.clinica_id = new.clinica_id and a.paciente_id = c.paciente_id);
  elsif TG_TABLE_NAME = 'lista_espera' then
    ok := exists (select 1 from pacientes where id = new.paciente_id and clinica_id = new.clinica_id)
      and exists (select 1 from especialidades where id = new.especialidade_id and clinica_id = new.clinica_id)
      and (new.profissional_id is null or exists (select 1 from profiles where id = new.profissional_id and clinica_id = new.clinica_id));
  elsif TG_TABLE_NAME = 'plano_metas' then
    ok := exists (select 1 from pacientes where id = new.paciente_id and clinica_id = new.clinica_id)
      and exists (select 1 from especialidades where id = new.especialidade_id and clinica_id = new.clinica_id);
  elsif TG_TABLE_NAME = 'evolucao_metas' then
    ok := exists (select 1 from evolucoes where id = new.evolucao_id and clinica_id = new.clinica_id
                    and paciente_id = new.paciente_id and especialidade_id = new.especialidade_id)
      and exists (select 1 from plano_metas where id = new.meta_id and clinica_id = new.clinica_id
                    and paciente_id = new.paciente_id and especialidade_id = new.especialidade_id);
  elsif TG_TABLE_NAME = 'modelos_evolucao' then
    ok := exists (select 1 from especialidades where id = new.especialidade_id and clinica_id = new.clinica_id);
  elsif TG_TABLE_NAME = 'guias_convenio' then
    ok := exists (select 1 from pacientes where id = new.paciente_id and clinica_id = new.clinica_id)
      and exists (select 1 from convenios where id = new.convenio_id and clinica_id = new.clinica_id)
      and exists (select 1 from especialidades where id = new.especialidade_id and clinica_id = new.clinica_id);
  elsif TG_TABLE_NAME = 'liberacoes_atendimento' then
    ok := exists (select 1 from agendamentos where id = new.agendamento_id and clinica_id = new.clinica_id)
      and (new.guia_id is null or exists (
        select 1 from guias_convenio g join agendamentos a on a.id = new.agendamento_id
        where g.id = new.guia_id and g.clinica_id = new.clinica_id and g.paciente_id = a.paciente_id));
  elsif TG_TABLE_NAME = 'glosas' then
    ok := exists (select 1 from pacientes where id = new.paciente_id and clinica_id = new.clinica_id)
      and exists (select 1 from convenios where id = new.convenio_id and clinica_id = new.clinica_id)
      and (new.guia_id is null or exists (select 1 from guias_convenio where id = new.guia_id and clinica_id = new.clinica_id and paciente_id = new.paciente_id))
      and (new.agendamento_id is null or exists (select 1 from agendamentos where id = new.agendamento_id and clinica_id = new.clinica_id and paciente_id = new.paciente_id));
  elsif TG_TABLE_NAME = 'faturas_liminar' then
    ok := exists (select 1 from pacientes where id = new.paciente_id and clinica_id = new.clinica_id)
      and exists (select 1 from convenios where id = new.convenio_id and clinica_id = new.clinica_id);
  elsif TG_TABLE_NAME = 'fatura_liminar_itens' then
    -- Sessão finalizada, do mesmo paciente e do mês do fechamento.
    ok := exists (
      select 1 from agendamentos a join faturas_liminar f on f.id = new.fatura_id
      where a.id = new.agendamento_id and a.clinica_id = new.clinica_id and f.clinica_id = new.clinica_id
        and a.paciente_id = f.paciente_id and a.status::text = 'finalizado'
        and date_trunc('month', a.inicio at time zone 'America/Sao_Paulo')::date = f.competencia);
  end if;
  if not ok then raise exception 'Registro de outra clínica não permitido' using errcode = '42501'; end if;
  return new;
end $$;
