-- =====================================================================
-- Etapa 1 · Pilar 1 — Integridade referencial, metadados e índices
-- =====================================================================

-- 1) Histórico clínico/financeiro nunca some em cascata: ON DELETE RESTRICT
do $$
declare r record; v_con text;
begin
  for r in select * from (values
    -- paciente → histórico
    ('agendamentos','paciente_id','pacientes'),
    ('evolucoes','paciente_id','pacientes'),
    ('paciente_documentos','paciente_id','pacientes'),
    ('plano_metas','paciente_id','pacientes'),
    ('evolucao_metas','paciente_id','pacientes'),
    ('relatorios_liberados','paciente_id','pacientes'),
    ('termos_assinaturas','paciente_id','pacientes'),
    ('guias_convenio','paciente_id','pacientes'),
    ('glosas','paciente_id','pacientes'),
    ('faturas_liminar','paciente_id','pacientes'),
    ('lista_espera','paciente_id','pacientes'),
    -- sessão → registros que dependem dela
    ('evolucoes','agendamento_id','agendamentos'),
    ('paciente_documentos','agendamento_id','agendamentos'),
    ('glosas','agendamento_id','agendamentos'),
    ('cobranca_itens','agendamento_id','agendamentos'),
    ('fatura_liminar_itens','agendamento_id','agendamentos'),
    -- prontuário / plano terapêutico
    ('evolucao_metas','evolucao_id','evolucoes'),
    ('evolucao_metas','meta_id','plano_metas'),
    ('plano_metas','especialidade_id','especialidades'),
    ('evolucao_metas','especialidade_id','especialidades'),
    ('glosas','guia_id','guias_convenio'),
    -- clínica → dados clínicos, financeiros e trilha de auditoria
    ('pacientes','clinica_id','clinicas'),
    ('agendamentos','clinica_id','clinicas'),
    ('atendimento_financeiro','clinica_id','clinicas'),
    ('evolucoes','clinica_id','clinicas'),
    ('evolucao_metas','clinica_id','clinicas'),
    ('plano_metas','clinica_id','clinicas'),
    ('paciente_documentos','clinica_id','clinicas'),
    ('relatorios_liberados','clinica_id','clinicas'),
    ('termos_assinaturas','clinica_id','clinicas'),
    ('guias_convenio','clinica_id','clinicas'),
    ('glosas','clinica_id','clinicas'),
    ('faturas_liminar','clinica_id','clinicas'),
    ('fatura_liminar_itens','clinica_id','clinicas'),
    ('cobrancas','clinica_id','clinicas'),
    ('cobranca_itens','clinica_id','clinicas'),
    ('liberacoes_atendimento','clinica_id','clinicas'),
    ('auditoria','clinica_id','clinicas')
  ) as v(t, c, rt) loop
    select k.conname into v_con
    from pg_constraint k
    join pg_attribute a on a.attrelid = k.conrelid and a.attnum = k.conkey[1]
    where k.contype = 'f' and k.conrelid = format('public.%I', r.t)::regclass
      and array_length(k.conkey, 1) = 1 and a.attname = r.c;
    if v_con is not null then
      execute format('alter table public.%I drop constraint %I', r.t, v_con);
    end if;
    execute format('alter table public.%I add constraint %I foreign key (%I) references public.%I(id) on delete restrict',
      r.t, r.t || '_' || r.c || '_fkey', r.c, r.rt);
  end loop;
end $$;

-- 2) Valores permitidos que ainda não tinham regra no banco
alter table public.paciente_documentos add constraint paciente_documentos_categoria_check
  check (categoria in ('Laudo','Relatório','Exame','Receita','Atestado','Documento pessoal','Termo / contrato','Encaminhamento','Outros'));
alter table public.paciente_documentos add constraint paciente_documentos_tamanho_check check (tamanho is null or tamanho >= 0);

-- 3) Metadados padronizados: quem criou e quando mudou
alter table public.pacientes      add column if not exists criado_por uuid default auth.uid();
alter table public.salas          add column if not exists criado_por uuid default auth.uid();
alter table public.especialidades add column if not exists criado_por uuid default auth.uid();
alter table public.convenios      add column if not exists criado_por uuid default auth.uid();
alter table public.termos_modelos add column if not exists criado_por uuid default auth.uid();
comment on column public.pacientes.criado_por is 'Usuário que criou o registro (auth.uid); sem FK porque desenvolvedores não têm perfil.';

alter table public.salas                add column if not exists updated_at timestamptz not null default now();
alter table public.especialidades       add column if not exists updated_at timestamptz not null default now();
alter table public.convenios            add column if not exists updated_at timestamptz not null default now();
alter table public.clinicas             add column if not exists updated_at timestamptz not null default now();
alter table public.paciente_documentos  add column if not exists updated_at timestamptz not null default now();
alter table public.relatorios_liberados add column if not exists updated_at timestamptz not null default now();
alter table public.termos_assinaturas   add column if not exists updated_at timestamptz not null default now();

create trigger trg_salas_updated          before update on public.salas                for each row execute function public.set_updated_at();
create trigger trg_especialidades_updated before update on public.especialidades       for each row execute function public.set_updated_at();
create trigger trg_convenios_updated      before update on public.convenios            for each row execute function public.set_updated_at();
create trigger trg_clinicas_updated       before update on public.clinicas             for each row execute function public.set_updated_at();
create trigger trg_documentos_updated     before update on public.paciente_documentos  for each row execute function public.set_updated_at();
create trigger trg_relatorios_updated     before update on public.relatorios_liberados for each row execute function public.set_updated_at();
create trigger trg_termos_ass_updated     before update on public.termos_assinaturas   for each row execute function public.set_updated_at();

-- 4) Índices nas colunas mais filtradas
create index if not exists agendamentos_paciente_inicio_idx     on public.agendamentos (paciente_id, inicio desc);
create index if not exists agendamentos_profissional_inicio_idx on public.agendamentos (profissional_id, inicio);
create index if not exists agendamentos_sala_inicio_idx         on public.agendamentos (sala_id, inicio);
create index if not exists agendamentos_clinica_inicio_idx      on public.agendamentos (clinica_id, inicio);
create index if not exists agendamentos_clinica_status_idx      on public.agendamentos (clinica_id, status, inicio);
create index if not exists agendamentos_especialidade_idx       on public.agendamentos (especialidade_id);
create index if not exists evolucoes_agendamento_idx  on public.evolucoes (agendamento_id) where agendamento_id is not null;
create index if not exists evolucoes_especialidade_idx on public.evolucoes (especialidade_id, paciente_id);
create index if not exists evolucoes_profissional_idx  on public.evolucoes (profissional_id, data_atendimento desc);
create index if not exists paciente_documentos_paciente_idx on public.paciente_documentos (paciente_id, created_at desc);
create index if not exists paciente_documentos_path_idx     on public.paciente_documentos (storage_path);
create index if not exists guias_convenio_tuss_idx        on public.guias_convenio (clinica_id, codigo_tuss);
create index if not exists guias_convenio_guia_idx        on public.guias_convenio (clinica_id, codigo_guia);
create index if not exists guias_convenio_faturamento_idx on public.guias_convenio (clinica_id, codigo_faturamento);
create index if not exists guias_convenio_convenio_idx    on public.guias_convenio (convenio_id, status);
create index if not exists guias_convenio_anexo_idx       on public.guias_convenio (anexo_path) where anexo_path is not null;
create index if not exists glosas_guia_idx        on public.glosas (guia_id) where guia_id is not null;
create index if not exists glosas_agendamento_idx on public.glosas (agendamento_id) where agendamento_id is not null;
create index if not exists glosas_paciente_idx    on public.glosas (paciente_id);
create index if not exists liberacoes_clinica_status_idx on public.liberacoes_atendimento (clinica_id, status);
create index if not exists lista_espera_paciente_idx     on public.lista_espera (paciente_id);
create index if not exists lista_espera_profissional_idx on public.lista_espera (profissional_id) where profissional_id is not null;
create index if not exists evolucao_metas_meta_idx on public.evolucao_metas (meta_id);
create index if not exists plano_metas_paciente_idx on public.plano_metas (paciente_id, especialidade_id);
create index if not exists termos_assinaturas_paciente_idx on public.termos_assinaturas (paciente_id, tipo, status);
create index if not exists relatorios_liberados_path_idx on public.relatorios_liberados (storage_path);
create index if not exists faturas_liminar_convenio_idx on public.faturas_liminar (convenio_id);
create index if not exists fatura_liminar_itens_fatura_idx2 on public.fatura_liminar_itens (fatura_id, agendamento_id);
create index if not exists pacientes_clinica_nome_idx on public.pacientes (clinica_id, nome);
create index if not exists pacientes_convenio_idx     on public.pacientes (convenio_id) where convenio_id is not null;
create index if not exists pacientes_cpf_idx          on public.pacientes (clinica_id, cpf) where cpf is not null;
create index if not exists cobrancas_status_idx       on public.cobrancas (clinica_id, status);
create index if not exists atendimento_financeiro_status_idx on public.atendimento_financeiro (clinica_id, pagamento_status);
create index if not exists profissional_especialidades_esp_idx on public.profissional_especialidades (especialidade_id);
create index if not exists auditoria_tabela_clinica_idx on public.auditoria (clinica_id, tabela, created_at desc);
create index if not exists auditoria_acao_idx           on public.auditoria (clinica_id, acao, created_at desc);
create index if not exists auditoria_registro_idx       on public.auditoria (registro_id) where registro_id is not null;
