import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Papel } from "./permissions";

function ok<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

export type ClinicaAtual = { id: string; nome: string; slug: string; ativa: boolean };

export type Me = {
  id: string;
  nome: string;
  email: string | null;
  conselho: string | null;
  registro: string | null;
  papeis: Papel[];
  especialidades: string[];
  /** Desenvolvedor CliniHelp com verificação em duas etapas concluída. */
  dev: boolean;
  /** E-mail de desenvolvedor, mas ainda sem a verificação em duas etapas nesta sessão. */
  dev_pendente: boolean;
  /**
   * Etapa de segurança que falta nesta sessão (equipe da clínica). Enquanto houver, o banco não libera os dados.
   * senha = trocar a senha temporária; codigo = digitar o código do autenticador; cadastro_2fa = cadastrar o autenticador.
   */
  pendencia: "senha" | "codigo" | "cadastro_2fa" | null;
  clinica: ClinicaAtual | null;
};

export const meQuery = queryOptions({
  queryKey: ["me"],
  staleTime: 60_000,
  queryFn: async (): Promise<Me> => {
    const { data, error } = await supabase.rpc("meu_contexto");
    if (error) throw new Error(error.message);
    if (!data) throw new Error("Sessão expirada");
    return data as unknown as Me;
  },
});

export const especialidadesQuery = queryOptions({
  queryKey: ["especialidades"],
  staleTime: 5 * 60_000,
  queryFn: async () => ok(await supabase.from("especialidades").select("*").order("nome")),
});

export const salasQuery = queryOptions({
  queryKey: ["salas"],
  staleTime: 60_000,
  queryFn: async () => ok(await supabase.from("salas").select("*").order("nome")),
});

export type Membro = {
  id: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  conselho: string | null;
  registro_profissional: string | null;
  ativo: boolean;
  /** Ainda com a senha temporária (não fez o primeiro acesso depois da criação/redefinição). */
  senha_temporaria: boolean;
  papeis: Papel[];
  especialidades: string[];
};

export const equipeQuery = queryOptions({
  queryKey: ["equipe"],
  staleTime: 30_000,
  queryFn: async (): Promise<Membro[]> => {
    const [p, r, e] = await Promise.all([
      supabase.from("profiles").select("*").order("nome"),
      supabase.from("user_roles").select("user_id, role"),
      supabase.from("profissional_especialidades").select("user_id, especialidade_id"),
    ]);
    const perfis = ok(p);
    const papeis = ok(r);
    const esp = ok(e);
    return perfis.map((x) => ({
      ...x,
      papeis: papeis.filter((y) => y.user_id === x.id).map((y) => y.role as Papel),
      especialidades: esp.filter((y) => y.user_id === x.id).map((y) => y.especialidade_id),
    }));
  },
});

export const configFinanceiraQuery = queryOptions({
  queryKey: ["profissional_config"],
  queryFn: async () => ok(await supabase.from("profissional_config").select("*")),
});

/** Nomes e tipos dos convênios (toda a equipe vê, para escolher no cadastro do paciente). */
export const conveniosQuery = queryOptions({
  queryKey: ["convenios"],
  staleTime: 60_000,
  queryFn: async () => ok(await supabase.from("convenios").select("id, nome, tipo, ativo").order("nome")),
});

/** Valores por sessão de cada convênio (só gestão e financeiro enxergam pelo RLS). */
export const convenioValoresQuery = queryOptions({
  queryKey: ["convenios", "valores"],
  queryFn: async () => ok(await supabase.from("convenio_valores").select("convenio_id, valor_sessao")),
});

export const LIMITE_AUDITORIA = 500;

export type FiltroAuditoria = { de: string; ate: string; usuario?: string | undefined; area?: string | undefined; acao?: string | undefined };

/** Registros de auditoria do período (RLS esconde o prontuário de quem não é master). */
export const auditoriaQuery = (f: FiltroAuditoria) =>
  queryOptions({
    queryKey: ["auditoria", f],
    queryFn: async () => {
      let q = supabase
        .from("auditoria")
        .select("*")
        .gte("created_at", new Date(`${f.de}T00:00:00`).toISOString())
        .lte("created_at", new Date(`${f.ate}T23:59:59.999`).toISOString())
        .order("created_at", { ascending: false })
        .limit(LIMITE_AUDITORIA);
      if (f.usuario) q = q.eq("usuario_id", f.usuario);
      if (f.area) q = q.eq("tabela", f.area);
      if (f.acao) q = q.eq("acao", f.acao);
      return ok(await q);
    },
  });

export const pacientesQuery = (busca: string) =>
  queryOptions({
    queryKey: ["pacientes", busca],
    queryFn: async () => {
      let q = supabase
        .from("pacientes")
        .select("id, nome, data_nascimento, responsavel_nome, responsavel_telefone, ativo, convenio, avaliacao:avaliacoes_iniciais(status)")
        .order("nome")
        .limit(500);
      if (busca.trim()) q = q.ilike("nome", `%${busca.trim()}%`);
      return ok(await q);
    },
  });

export const pacientesOpcoesQuery = queryOptions({
  queryKey: ["pacientes", "opcoes"],
  queryFn: async () =>
    ok(await supabase.from("pacientes").select("id, nome, data_nascimento").eq("ativo", true).order("nome").limit(1000)),
});

export const pacienteQuery = (id: string) =>
  queryOptions({
    queryKey: ["paciente", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("pacientes").select("*").eq("id", id).single();
      if (error) throw new Error(error.message);
      return data;
    },
  });

export const documentosQuery = (pacienteId: string) =>
  queryOptions({
    queryKey: ["documentos", pacienteId],
    queryFn: async () =>
      ok(
        await supabase
          .from("paciente_documentos")
          .select("*, sessao:agendamentos(inicio, status)")
          .eq("paciente_id", pacienteId)
          .order("created_at", { ascending: false }),
      ),
  });

export const evolucoesQuery = (pacienteId: string) =>
  queryOptions({
    queryKey: ["evolucoes", pacienteId],
    queryFn: async () =>
      ok(
        await supabase
          .from("evolucoes")
          .select("*")
          .eq("paciente_id", pacienteId)
          .order("data_atendimento", { ascending: false })
          .order("created_at", { ascending: false }),
      ),
  });

export const metasQuery = (pacienteId: string) =>
  queryOptions({
    queryKey: ["metas", pacienteId],
    queryFn: async () =>
      ok(
        await supabase
          .from("plano_metas")
          .select("*")
          .eq("paciente_id", pacienteId)
          .order("status")
          .order("created_at"),
      ),
  });

/** Progresso das metas com a data da evolução em que foi registrado. */
export const progressoMetasQuery = (pacienteId: string) =>
  queryOptions({
    queryKey: ["evolucoes", pacienteId, "metas"],
    queryFn: async () => {
      const rows = ok(
        await supabase
          .from("evolucao_metas")
          .select("id, meta_id, evolucao_id, nivel, evolucao:evolucoes(data_atendimento)")
          .eq("paciente_id", pacienteId),
      );
      return rows.map((r) => ({
        id: r.id,
        meta_id: r.meta_id,
        evolucao_id: r.evolucao_id,
        nivel: r.nivel,
        data: r.evolucao?.data_atendimento ?? "",
      }));
    },
  });

export const modelosEvolucaoQuery = queryOptions({
  queryKey: ["modelos_evolucao"],
  staleTime: 5 * 60_000,
  queryFn: async () => ok(await supabase.from("modelos_evolucao").select("*").order("nome")),
});

// liberacao: só vem preenchida para quem pode ver guias (recepção/gestão/financeiro); para os demais o RLS devolve null.
const AGENDA_SELECT =
  "*, liberacao:liberacoes_atendimento(status, token, guia_id), paciente:pacientes(id, nome, convenio_id, responsavel_nome, responsavel_telefone, responsavel2_nome, responsavel2_telefone), profissional:profiles(id, nome), sala:salas(id, nome), especialidade:especialidades(id, nome, cor), documentos:paciente_documentos(id, nome, storage_path, mime_type)";

async function fetchAgenda(inicioISO: string, fimISO: string) {
  return ok(
    await supabase
      .from("agendamentos")
      .select(AGENDA_SELECT)
      .gte("inicio", inicioISO)
      .lt("inicio", fimISO)
      .order("inicio"),
  );
}
export type AgendaItem = Awaited<ReturnType<typeof fetchAgenda>>[number];

export const agendaQuery = (inicioISO: string, fimISO: string) =>
  queryOptions({
    queryKey: ["agenda", inicioISO, fimISO],
    queryFn: () => fetchAgenda(inicioISO, fimISO),
  });

export const agendaPacienteQuery = (pacienteId: string) =>
  queryOptions({
    queryKey: ["agenda", "paciente", pacienteId],
    queryFn: async (): Promise<AgendaItem[]> =>
      ok(
        await supabase
          .from("agendamentos")
          .select(AGENDA_SELECT)
          .eq("paciente_id", pacienteId)
          .order("inicio", { ascending: false })
          .limit(300),
      ),
  });

export const financeiroQuery = (inicioISO: string, fimISO: string) =>
  queryOptions({
    queryKey: ["financeiro", inicioISO, fimISO],
    queryFn: async () =>
      ok(
        await supabase
          .from("agendamentos")
          .select(
            "id, inicio, status, profissional_id, paciente:pacientes(nome), profissional:profiles(nome), especialidade:especialidades(nome), fin:atendimento_financeiro!inner(*)",
          )
          .gte("inicio", inicioISO)
          .lt("inicio", fimISO)
          .order("inicio"),
      ),
  });

/** Se a clínica já pode gerar cobranças (conta de recebimento ativada pelo suporte CliniHelp). */
export const recebimentosAtivosQuery = (clinicaId: string) =>
  queryOptions({
    queryKey: ["clinica", clinicaId, "recebimentos"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clinicas").select("pagamentos_ativos").eq("id", clinicaId).maybeSingle();
      if (error) throw new Error(error.message);
      return data?.pagamentos_ativos ?? false;
    },
  });

/** Cobranças com vencimento no período (RLS: só gestão e financeiro). */
export const cobrancasQuery = (de: string, ate: string) =>
  queryOptions({
    queryKey: ["cobrancas", de, ate],
    queryFn: async () =>
      ok(
        await supabase
          .from("cobrancas")
          .select("id, paciente_id, tipo, descricao, valor, vencimento, forma, status, pagador_nome, pagador_telefone, token_publico, pago_em, valor_pago, created_at, paciente:pacientes(nome), itens:cobranca_itens(agendamento_id)")
          .gte("vencimento", de)
          .lte("vencimento", ate)
          .order("vencimento", { ascending: false })
          .order("created_at", { ascending: false }),
      ),
  });

/** Sessões do paciente no período, com valor e se já estão em alguma cobrança. */
export const sessoesParaCobrarQuery = (pacienteId: string, inicioISO: string, fimISO: string) =>
  queryOptions({
    queryKey: ["cobrancas", "sessoes", pacienteId, inicioISO, fimISO],
    enabled: !!pacienteId,
    queryFn: async () =>
      ok(
        await supabase
          .from("agendamentos")
          .select("id, inicio, status, especialidade:especialidades(nome), profissional:profiles(nome), fin:atendimento_financeiro!inner(valor, pagamento_status, cobrar), itens:cobranca_itens(cobranca:cobrancas(status))")
          .eq("paciente_id", pacienteId)
          .not("status", "in", "(cancelado,falta_justificada,falta_terapeuta)")
          .gte("inicio", inicioISO)
          .lt("inicio", fimISO)
          .order("inicio"),
      ),
  });

/** Busca todas as linhas em páginas de 1000 (limite por consulta do banco). */
async function todasAsPaginas<T>(pagina: (de: number, ate: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>) {
  const todas: T[] = [];
  for (let de = 0; ; de += 1000) {
    const res = await pagina(de, de + 999);
    const lote = ok(res);
    todas.push(...lote);
    if (lote.length < 1000) return todas;
  }
}

/** Sessões do mês para os indicadores (valores só aparecem para gestão/financeiro pelo RLS). */
export const indicadoresQuery = (inicioISO: string, fimISO: string) =>
  queryOptions({
    queryKey: ["indicadores", inicioISO, fimISO],
    queryFn: () =>
      todasAsPaginas((de, ate) =>
        supabase
          .from("agendamentos")
          .select("id, inicio, fim, status, sala_id, paciente_id, especialidade_id, paciente:pacientes(nome), especialidade:especialidades(nome, cor), fin:atendimento_financeiro(valor, pagamento_status, cobrar)")
          .gte("inicio", inicioISO)
          .lt("inicio", fimISO)
          .order("inicio")
          .order("id")
          .range(de, ate),
      ),
  });

/** Sessões faturáveis (finalizadas ou faltas cobradas) ainda não pagas, de qualquer mês até a data informada. */
export const aReceberQuery = (ateISO: string) =>
  queryOptions({
    queryKey: ["indicadores", "a-receber", ateISO],
    queryFn: () =>
      todasAsPaginas((de, ate) =>
        supabase
          .from("agendamentos")
          .select("id, inicio, fin:atendimento_financeiro!inner(valor)")
          .in("status", ["finalizado", "falta_cobrada"])
          .eq("fin.cobrar", true)
          .eq("fin.pagamento_status", "pendente")
          .lt("inicio", ateISO)
          .order("inicio")
          .order("id")
          .range(de, ate),
      ),
  });

/** Lista de espera da clínica (toda a equipe vê; recepção e gestão editam). */
export const listaEsperaQuery = queryOptions({
  queryKey: ["lista_espera"],
  queryFn: async () =>
    ok(
      await supabase
        .from("lista_espera")
        .select("*, paciente:pacientes(id, nome, data_nascimento, responsavel_nome, responsavel_telefone), especialidade:especialidades(id, nome, cor), profissional:profiles(id, nome)")
        .order("created_at")
        .limit(1000),
    ),
});
export type ItemEspera = Awaited<ReturnType<NonNullable<typeof listaEsperaQuery.queryFn>>>[number];

export const termosPacienteQuery = (pacienteId: string) =>
  queryOptions({
    queryKey: ["termos", pacienteId],
    queryFn: async () =>
      ok(
        await supabase
          .from("termos_assinaturas")
          .select("id, tipo, titulo, status, created_at, solicitado_por_nome, assinado_em, assinante_nome, assinante_parentesco, decisao")
          .eq("paciente_id", pacienteId)
          .order("created_at", { ascending: false }),
      ),
  });

export const termosModelosQuery = queryOptions({
  queryKey: ["termos_modelos"],
  staleTime: 5 * 60_000,
  queryFn: async () => ok(await supabase.from("termos_modelos").select("*").eq("ativo", true).order("titulo")),
});

export const relatoriosLiberadosQuery = (pacienteId: string) =>
  queryOptions({
    queryKey: ["relatorios_liberados", pacienteId],
    queryFn: async () =>
      ok(
        await supabase
          .from("relatorios_liberados")
          .select("*")
          .eq("paciente_id", pacienteId)
          .order("created_at", { ascending: false }),
      ),
  });

/** Guias de convênio da clínica (recepção, gestão e financeiro). */
export const guiasQuery = queryOptions({
  queryKey: ["guias", "lista"],
  queryFn: () =>
    todasAsPaginas((de, ate) =>
      supabase
        .from("guias_convenio")
        .select("*, paciente:pacientes(id, nome, carteirinha), convenio:convenios(id, nome, tipo), especialidade:especialidades(id, nome, cor)")
        .order("created_at", { ascending: false })
        .order("id")
        .range(de, ate),
    ),
});
export type Guia = Awaited<ReturnType<NonNullable<typeof guiasQuery.queryFn>>>[number];

/** Sessões confirmadas/realizadas (usadas) e agendadas (reservadas) por guia. */
export const guiasUsoQuery = queryOptions({
  queryKey: ["guias", "uso"],
  queryFn: () =>
    todasAsPaginas((de, ate) => supabase.from("guias_uso").select("guia_id, usadas, reservadas").order("guia_id").range(de, ate)),
});

/** Sessões finalizadas no período com os códigos da guia, para conferência e lançamento no portal da operadora. */
export const faturamentoGuiasQuery = (inicioISO: string, fimISO: string) =>
  queryOptions({
    queryKey: ["guias", "faturamento", inicioISO, fimISO],
    queryFn: () =>
      todasAsPaginas((de, ate) =>
        supabase
          .from("agendamentos")
          .select(
            "id, inicio, paciente_id, especialidade_id, paciente:pacientes(id, nome, convenio_id, carteirinha), profissional:profiles(nome, conselho, registro_profissional), especialidade:especialidades(nome), liberacao:liberacoes_atendimento(status, token, guia:guias_convenio(id, codigo_tuss, codigo_guia, codigo_faturamento, convenio_id, status)), fin:atendimento_financeiro(valor)",
          )
          .eq("status", "finalizado")
          .gte("inicio", inicioISO)
          .lt("inicio", fimISO)
          .order("inicio")
          .order("id")
          .range(de, ate),
      ),
  });
export type LinhaFaturamento = Awaited<ReturnType<NonNullable<ReturnType<typeof faturamentoGuiasQuery>["queryFn"]>>>[number];

/** Glosas (só gestão e financeiro pelo RLS). */
export const glosasQuery = queryOptions({
  queryKey: ["glosas"],
  queryFn: () =>
    todasAsPaginas((de, ate) =>
      supabase
        .from("glosas")
        .select("*, paciente:pacientes(id, nome), convenio:convenios(id, nome), guia:guias_convenio(id, codigo_guia), agendamento:agendamentos(id, inicio)")
        .order("data_glosa", { ascending: false })
        .order("id")
        .range(de, ate),
    ),
});
export type Glosa = Awaited<ReturnType<NonNullable<typeof glosasQuery.queryFn>>>[number];

/** Sessões finalizadas no mês com o que a lista de presença e o fechamento da liminar precisam (filtra-se o tipo liminar na tela). */
export const sessoesLiminarQuery = (inicioISO: string, fimISO: string) =>
  queryOptions({
    queryKey: ["liminar", "sessoes", inicioISO, fimISO],
    queryFn: () =>
      todasAsPaginas((de, ate) =>
        supabase
          .from("agendamentos")
          .select(
            "id, inicio, fim, paciente_id, paciente:pacientes(id, nome, data_nascimento, cpf, carteirinha, convenio_id, responsavel_nome, responsavel_cpf), profissional:profiles(nome, conselho, registro_profissional), especialidade:especialidades(nome), fin:atendimento_financeiro(valor), item:fatura_liminar_itens(fatura_id)",
          )
          .eq("status", "finalizado")
          .gte("inicio", inicioISO)
          .lt("inicio", fimISO)
          .order("inicio")
          .order("id")
          .range(de, ate),
      ),
  });
export type SessaoLiminar = Awaited<ReturnType<NonNullable<ReturnType<typeof sessoesLiminarQuery>["queryFn"]>>>[number];

/** Fechamentos da liminar (NF, vencimento, pagamento) — só gestão e financeiro pelo RLS. */
export const faturasLiminarQuery = queryOptions({
  queryKey: ["liminar", "faturas"],
  queryFn: () =>
    todasAsPaginas((de, ate) =>
      supabase
        .from("faturas_liminar")
        .select("*, paciente:pacientes(id, nome), convenio:convenios(id, nome)")
        .order("competencia", { ascending: false })
        .order("id")
        .range(de, ate),
    ),
});
export type FaturaLiminar = Awaited<ReturnType<NonNullable<typeof faturasLiminarQuery.queryFn>>>[number];

/** Avaliação inicial do paciente (a cobrança ligada só aparece para gestão/financeiro, pelo RLS). */
export const avaliacaoInicialQuery = (pacienteId: string) =>
  queryOptions({
    queryKey: ["avaliacao-inicial", pacienteId],
    queryFn: async () =>
      ok(
        await supabase
          .from("avaliacoes_iniciais")
          .select("*, cobranca:cobrancas(id, status, valor, vencimento, token_publico)")
          .eq("paciente_id", pacienteId)
          .maybeSingle(),
      ),
  });

/** Avaliações em andamento ou recém-concluídas, para o aviso do Painel. */
export const avaliacoesAbertasQuery = queryOptions({
  queryKey: ["avaliacao-inicial", "abertas"],
  queryFn: async () => {
    const desde = new Date(Date.now() - 60 * 86_400_000).toISOString();
    return ok(
      await supabase
        .from("avaliacoes_iniciais")
        .select("paciente_id, status, preenchido_em, formulario_liberado_em, created_at, paciente:pacientes(nome, ativo, agendamentos(count))")
        .or(`status.in.(aguardando_pagamento,aguardando_formulario),and(status.eq.concluida,preenchido_em.gte.${desde})`)
        .order("created_at", { ascending: false })
        .limit(100),
    );
  },
});

/** Entrevista inicial preenchida pela família (só quem vê dados clínicos). */
export const anamneseQuery = (pacienteId: string) =>
  queryOptions({
    queryKey: ["anamnese", pacienteId],
    queryFn: async () => {
      const [a, p] = await Promise.all([
        supabase.from("anamneses").select("*").eq("paciente_id", pacienteId).maybeSingle(),
        supabase
          .from("anamnese_pareceres")
          .select("*, especialidade:especialidades(nome)")
          .eq("paciente_id", pacienteId)
          .order("created_at"),
      ]);
      return { anamnese: ok(a), pareceres: ok(p) ?? [] };
    },
  });
