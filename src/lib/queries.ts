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
        .select("id, nome, data_nascimento, diagnostico, responsavel_nome, responsavel_telefone, ativo, convenio")
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
          .select("*")
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

const AGENDA_SELECT =
  "*, paciente:pacientes(id, nome), profissional:profiles(id, nome), sala:salas(id, nome), especialidade:especialidades(id, nome, cor)";

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
          .select("id, inicio, status, especialidade:especialidades(nome), profissional:profiles(nome), fin:atendimento_financeiro!inner(valor, pagamento_status), itens:cobranca_itens(cobranca:cobrancas(status))")
          .eq("paciente_id", pacienteId)
          .neq("status", "cancelado")
          .gte("inicio", inicioISO)
          .lt("inicio", fimISO)
          .order("inicio"),
      ),
  });
