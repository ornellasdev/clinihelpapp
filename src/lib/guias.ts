import { differenceInCalendarDays, parseISO } from "date-fns";

/** Situação gravada no banco. "Em uso", "Concluída" e "Vencida" são calculadas a partir do uso e da validade. */
export type StatusGuia = "solicitada" | "autorizada" | "negada" | "faturada" | "cancelada";
export type SituacaoGuia = StatusGuia | "em_uso" | "concluida" | "vencida";

export const SITUACAO_GUIA: Record<SituacaoGuia, { label: string; className: string }> = {
  solicitada: { label: "Solicitada", className: "bg-muted text-muted-foreground" },
  autorizada: { label: "Autorizada", className: "bg-secondary text-secondary-foreground" },
  em_uso: { label: "Em uso", className: "bg-primary/10 text-primary" },
  concluida: { label: "Concluída", className: "bg-success/15 text-success" },
  vencida: { label: "Vencida", className: "bg-destructive/10 text-destructive" },
  faturada: { label: "Faturada", className: "bg-success/25 text-success" },
  negada: { label: "Negada", className: "bg-destructive/10 text-destructive" },
  cancelada: { label: "Cancelada", className: "bg-muted text-muted-foreground line-through" },
};

export const STATUS_GRAVADOS: { value: StatusGuia; label: string }[] = [
  { value: "solicitada", label: "Solicitada" },
  { value: "autorizada", label: "Autorizada" },
  { value: "negada", label: "Negada pela operadora" },
  { value: "faturada", label: "Faturada" },
  { value: "cancelada", label: "Cancelada" },
];

export type GuiaBase = {
  id: string;
  paciente_id: string;
  especialidade_id: string;
  status: string;
  sessoes_autorizadas: number | null;
  validade: string | null;
  created_at: string;
};

/** Sessões finalizadas vinculadas a cada guia (faltas não descontam). */
export type UsoGuias = ReadonlyMap<string, number>;

export function usoPorGuia(linhas: readonly { guia_id: string | null; usadas: number | null }[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const l of linhas) if (l.guia_id) m.set(l.guia_id, l.usadas ?? 0);
  return m;
}

/** Saldo = autorizadas − usadas (nunca negativo). */
export function saldoGuia(g: Pick<GuiaBase, "sessoes_autorizadas">, usadas: number): number {
  return Math.max(0, (g.sessoes_autorizadas ?? 0) - usadas);
}

export function situacaoGuia(g: Pick<GuiaBase, "status" | "sessoes_autorizadas" | "validade">, usadas: number, hoje: string): SituacaoGuia {
  if (g.status !== "autorizada") return g.status as StatusGuia;
  if (saldoGuia(g, usadas) <= 0) return "concluida";
  if (g.validade && g.validade < hoje) return "vencida";
  return usadas > 0 ? "em_uso" : "autorizada";
}

/**
 * Guia que a sessão deve consumir: mesmo paciente e especialidade, autorizada, válida na data
 * e com saldo; entre várias, a que vence primeiro. Mesma regra do gatilho vincular_guia_sessao no banco.
 */
export function guiaParaSessao<G extends GuiaBase>(
  guias: readonly G[],
  uso: UsoGuias,
  s: { paciente_id: string; especialidade_id: string; data: string },
): G | null {
  const candidatas = guias
    .filter(
      (g) =>
        g.paciente_id === s.paciente_id &&
        g.especialidade_id === s.especialidade_id &&
        g.status === "autorizada" &&
        !!g.validade &&
        g.validade >= s.data &&
        saldoGuia(g, uso.get(g.id) ?? 0) > 0,
    )
    .sort((a, b) => (a.validade ?? "").localeCompare(b.validade ?? "") || a.created_at.localeCompare(b.created_at));
  return candidatas[0] ?? null;
}

/** Só convênio depende de guia da operadora. Particular não; liminar também não (usa lista de presença e NF). */
export const exigeGuia = (tipoConvenio?: string | null) => tipoConvenio === "convenio";

export type StatusLiberacao = "pendente" | "aguardando" | "liberado";
export const STATUS_LIBERACAO: Record<StatusLiberacao, { label: string; curto: string; className: string }> = {
  pendente: { label: "Pendente de solicitação", curto: "Pendente", className: "bg-warning/25 text-warning-foreground" },
  aguardando: { label: "Aguardando liberação do plano", curto: "Aguardando", className: "bg-secondary text-secondary-foreground" },
  liberado: { label: "Liberado / token validado", curto: "Liberado", className: "bg-success/15 text-success" },
};

export type AlertaSessao = "sem_guia" | "aguardando_guia" | "guia_vencida" | "saldo_zerado" | "limite_excedido";
export const ALERTA_SESSAO: Record<AlertaSessao, string> = {
  sem_guia: "Sem guia cadastrada",
  aguardando_guia: "Guia ainda não autorizada",
  guia_vencida: "Guia vencida",
  saldo_zerado: "Saldo de sessões zerado",
  limite_excedido: "Sessões acima do autorizado",
};

/**
 * Risco de glosa de uma sessão de convênio. Com guia vinculada, confere validade e limite;
 * sem guia, procura uma guia utilizável e, se não houver, explica o motivo.
 */
export function alertaSessao<G extends GuiaBase>(
  guias: readonly G[],
  uso: UsoGuias,
  s: { paciente_id: string; especialidade_id: string; data: string; guia_id?: string | null },
): AlertaSessao | null {
  if (s.guia_id) {
    const g = guias.find((x) => x.id === s.guia_id);
    if (g) {
      if (g.validade && g.validade < s.data) return "guia_vencida";
      if ((uso.get(g.id) ?? 0) > (g.sessoes_autorizadas ?? 0)) return "limite_excedido";
      return null;
    }
  }
  if (guiaParaSessao(guias, uso, s)) return null;
  const doPaciente = guias.filter((g) => g.paciente_id === s.paciente_id && g.especialidade_id === s.especialidade_id);
  const autorizadas = doPaciente.filter((g) => g.status === "autorizada");
  if (autorizadas.some((g) => !!g.validade && g.validade >= s.data)) return "saldo_zerado";
  if (doPaciente.some((g) => g.status === "solicitada")) return "aguardando_guia";
  if (autorizadas.length > 0) return "guia_vencida";
  return "sem_guia";
}

export const AVISO_DIAS_VENCIMENTO = 7;
export const AVISO_SESSOES_RESTANTES = 2;

export type AvisoGuia<G> = { guia: G; vence: boolean; poucas: boolean; diasParaVencer: number; saldo: number };

/** Guias em uso que vencem em até 7 dias ou têm 2 sessões ou menos: hora de pedir renovação. */
export function avisosGuias<G extends GuiaBase>(guias: readonly G[], uso: UsoGuias, hoje: string): AvisoGuia<G>[] {
  const out: AvisoGuia<G>[] = [];
  for (const g of guias) {
    const usadas = uso.get(g.id) ?? 0;
    const sit = situacaoGuia(g, usadas, hoje);
    if (sit !== "autorizada" && sit !== "em_uso") continue;
    const saldo = saldoGuia(g, usadas);
    const diasParaVencer = g.validade ? differenceInCalendarDays(parseISO(g.validade), parseISO(hoje)) : Infinity;
    const vence = diasParaVencer <= AVISO_DIAS_VENCIMENTO;
    const poucas = saldo <= AVISO_SESSOES_RESTANTES;
    if (vence || poucas) out.push({ guia: g, vence, poucas, diasParaVencer, saldo });
  }
  return out.sort((a, b) => a.diasParaVencer - b.diasParaVencer || a.saldo - b.saldo);
}

// ---------- Glosas ----------

export type StatusGlosa = "identificada" | "em_recurso" | "recuperada" | "perda";
export const STATUS_GLOSA: Record<StatusGlosa, { label: string; className: string }> = {
  identificada: { label: "Glosa identificada", className: "bg-warning/25 text-warning-foreground" },
  em_recurso: { label: "Em recurso", className: "bg-secondary text-secondary-foreground" },
  recuperada: { label: "Recuperada (paga)", className: "bg-success/15 text-success" },
  perda: { label: "Perda definitiva", className: "bg-destructive/10 text-destructive" },
};

export const MOTIVOS_GLOSA: { value: string; label: string }[] = [
  { value: "token", label: "Falha de token / validação" },
  { value: "guia_vencida", label: "Guia vencida" },
  { value: "tuss", label: "Erro de código TUSS" },
  { value: "limite", label: "Limite de sessões excedido" },
  { value: "sem_autorizacao", label: "Sem autorização" },
  { value: "documentacao", label: "Documentação incompleta" },
  { value: "outro", label: "Outro motivo" },
];
export const rotuloMotivo = (m: string) => MOTIVOS_GLOSA.find((x) => x.value === m)?.label ?? m;

type GlosaBase = { convenio_id: string; status: string; valor: number | string; convenio?: { nome: string } | null };

export type ResumoGlosas = { retido: number; recuperado: number; perda: number; total: number };

/** Retido = identificada + em recurso (dinheiro ainda em disputa). Recuperada e perda são o desfecho. */
export function resumoGlosas(glosas: readonly GlosaBase[]) {
  const r = (n: number) => Math.round(n * 100) / 100;
  const porConvenio = new Map<string, ResumoGlosas & { nome: string }>();
  const total: ResumoGlosas = { retido: 0, recuperado: 0, perda: 0, total: 0 };
  for (const g of glosas) {
    const v = Number(g.valor) || 0;
    const c = porConvenio.get(g.convenio_id) ?? { nome: g.convenio?.nome ?? "—", retido: 0, recuperado: 0, perda: 0, total: 0 };
    const chave = g.status === "recuperada" ? "recuperado" : g.status === "perda" ? "perda" : "retido";
    c[chave] = r(c[chave] + v);
    c.total = r(c.total + v);
    total[chave] = r(total[chave] + v);
    total.total = r(total.total + v);
    porConvenio.set(g.convenio_id, c);
  }
  return { total, porConvenio: [...porConvenio.values()].sort((a, b) => b.retido - a.retido || b.total - a.total) };
}
