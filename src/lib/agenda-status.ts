/**
 * Máquina de status da agenda e suas regras financeiras.
 * As regras de cobrança/repasse/guia espelham os gatilhos do banco
 * (sincronizar_financeiro_status, vincular_guia_sessao e a view guias_uso).
 */
export type StatusAgenda =
  | "agendado"
  | "aguardando"
  | "em_atendimento"
  | "finalizado"
  | "falta_justificada"
  | "falta_terapeuta"
  | "falta_cobrada"
  | "cancelado";

export const STATUS_FLUXO = ["agendado", "aguardando", "em_atendimento", "finalizado"] as const satisfies readonly StatusAgenda[];
export const STATUS_FALTAS = ["falta_justificada", "falta_terapeuta", "falta_cobrada"] as const satisfies readonly StatusAgenda[];
export type StatusFalta = (typeof STATUS_FALTAS)[number];

/** Sessões que entram no faturamento: atendida (finalizada) ou falta cobrada. */
export const STATUS_FATURAVEIS: readonly StatusAgenda[] = ["finalizado", "falta_cobrada"];
/** Sessões que ainda vão acontecer (previsão). */
export const STATUS_PREVISTOS: readonly StatusAgenda[] = ["agendado", "aguardando", "em_atendimento"];
/** Status que não podem entrar em cobrança para a família. */
export const STATUS_SEM_COBRANCA: readonly StatusAgenda[] = ["falta_justificada", "falta_terapeuta", "cancelado"];

export const ehFalta = (s: string): s is StatusFalta => (STATUS_FALTAS as readonly string[]).includes(s);
/** Falta do paciente (justificada ou não). A do terapeuta não conta na taxa de faltas do paciente. */
export const ehFaltaDoPaciente = (s: string) => s === "falta_justificada" || s === "falta_cobrada";
export const ehFaturavel = (s: string) => (STATUS_FATURAVEIS as readonly string[]).includes(s);
export const ehPrevisto = (s: string) => (STATUS_PREVISTOS as readonly string[]).includes(s);

export type RegraFinanceira = { cobrar: boolean; repassar: boolean; descontaGuia: boolean };

/**
 * O que cada status provoca:
 * - Finalizado: cobra, repassa e desconta 1 sessão da guia.
 * - Falta justificada / do terapeuta / cancelado: não cobra, não repassa, não desconta.
 * - Falta não justificada: cobra; repasse conforme decidido na hora (padrão: sim); não desconta guia.
 * - Antes do atendimento: previsão (cobra e repassa quando finalizar).
 */
export function regraFinanceira(status: string, faltaRepasse?: boolean | null): RegraFinanceira {
  const cobrar = !(STATUS_SEM_COBRANCA as readonly string[]).includes(status);
  const repassar = cobrar && (status !== "falta_cobrada" || (faltaRepasse ?? true));
  return { cobrar, repassar, descontaGuia: status === "finalizado" };
}

/** Status em que o profissional já pode chamar a criança / está atendendo — a fila do terapeuta. */
export const NA_FILA: readonly StatusAgenda[] = ["aguardando", "em_atendimento"];

/** Ordem da lista "Meus atendimentos de hoje": em atendimento, aguardando, depois o resto por horário. */
export function ordemFila(a: { status: string; inicio: string }, b: { status: string; inicio: string }) {
  const peso = (s: string) => (s === "em_atendimento" ? 0 : s === "aguardando" ? 1 : ehPrevisto(s) ? 2 : 3);
  return peso(a.status) - peso(b.status) || a.inicio.localeCompare(b.inicio);
}

/** Ao abrir a evolução da sessão, ela passa para "Em atendimento" se ainda não começou. */
export const iniciaAoAbrirEvolucao = (s: string) => s === "agendado" || s === "aguardando";
