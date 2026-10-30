// Liminar: não usa guia. Fecha-se o mês com lista de presença + nota fiscal; o pagamento vence 30 dias após a emissão da NF.

/** Prazo de pagamento da liminar, em dias corridos a partir da emissão da NF (o banco usa o mesmo número). */
export const DIAS_PAGAMENTO_LIMINAR = 30;

export type StatusFatura = "aguardando_nf" | "nf_emitida" | "paga";
export type SituacaoFatura = "aguardando_nf" | "a_receber" | "vencida" | "paga";

export const SITUACAO_FATURA: Record<SituacaoFatura, { label: string; className: string }> = {
  aguardando_nf: { label: "Aguardando NF", className: "bg-warning/15 text-warning-foreground" },
  a_receber: { label: "A receber", className: "bg-primary/10 text-primary" },
  vencida: { label: "Vencida", className: "bg-destructive/10 text-destructive" },
  paga: { label: "Paga", className: "bg-success/15 text-success" },
};

const dia = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00Z`);
const isoDia = (d: Date) => d.toISOString().slice(0, 10);

/** Vencimento = emissão da NF + 30 dias corridos (yyyy-MM-dd). */
export function vencimentoNF(emissao: string) {
  const d = dia(emissao);
  d.setUTCDate(d.getUTCDate() + DIAS_PAGAMENTO_LIMINAR);
  return isoDia(d);
}

/** Dias até o vencimento (negativo = atrasada). */
export function diasParaVencer(vencimento: string, hoje: string) {
  return Math.round((dia(vencimento).getTime() - dia(hoje).getTime()) / 86_400_000);
}

/** NF emitida e não paga vence no dia do vencimento; só fica "vencida" no dia seguinte. */
export function situacaoFatura(f: { status: string; vencimento: string | null }, hoje: string): SituacaoFatura {
  if (f.status === "paga") return "paga";
  if (f.status === "aguardando_nf" || !f.vencimento) return "aguardando_nf";
  return f.vencimento < hoje ? "vencida" : "a_receber";
}

type FaturaResumo = { status: string; vencimento: string | null; valor: number | string; valor_pago?: number | string | null; pago_em?: string | null };
type Soma = { n: number; valor: number };
const nova = (): Soma => ({ n: 0, valor: 0 });

/** Totais para os indicadores: o que falta emitir, o que está a receber (e vencido) e o que entrou no mês. */
export function resumoLiminar(faturas: FaturaResumo[], hoje: string, mes: string) {
  const r = { aguardandoNf: nova(), aReceber: nova(), vencidas: nova(), venceEm7: nova(), recebidoNoMes: nova() };
  for (const f of faturas) {
    const v = Number(f.valor);
    const s = situacaoFatura(f, hoje);
    if (s === "aguardando_nf") (r.aguardandoNf.n++, (r.aguardandoNf.valor += v));
    if (s === "a_receber" || s === "vencida") (r.aReceber.n++, (r.aReceber.valor += v));
    if (s === "vencida") (r.vencidas.n++, (r.vencidas.valor += v));
    if (s === "a_receber" && f.vencimento && diasParaVencer(f.vencimento, hoje) <= 7) (r.venceEm7.n++, (r.venceEm7.valor += v));
    if (s === "paga" && f.pago_em?.startsWith(mes)) (r.recebidoNoMes.n++, (r.recebidoNoMes.valor += Number(f.valor_pago ?? f.valor)));
  }
  return r;
}

/** Primeiro dia do mês (yyyy-MM-01) da competência. */
export const competenciaDe = (mes: string) => `${mes.slice(0, 7)}-01`;

/** Sessões realizadas do paciente no mês que ainda não entraram em nenhum fechamento. */
export function sessoesForaDoFechamento<T extends { item: { fatura_id: string } | null }>(sessoes: T[]) {
  return sessoes.filter((s) => !s.item);
}
