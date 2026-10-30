import { differenceInCalendarDays, parseISO } from "date-fns";

export const DIAS_SEMANA = [
  { v: 1, l: "Seg" },
  { v: 2, l: "Ter" },
  { v: 3, l: "Qua" },
  { v: 4, l: "Qui" },
  { v: 5, l: "Sex" },
  { v: 6, l: "Sáb" },
] as const;

export const PERIODOS = [
  { v: "manha", l: "Manhã" },
  { v: "tarde", l: "Tarde" },
  { v: "noite", l: "Noite" },
] as const;

export const STATUS_ESPERA: Record<string, string> = {
  aguardando: "Aguardando",
  agendado: "Agendado",
  desistiu: "Desistiu",
};

type ItemFila = { id: string; especialidade_id: string; prioridade: string; created_at: string };

/** Ordem da fila: prioridade alta primeiro; depois quem entrou antes. */
export function ordenarFila<T extends ItemFila>(itens: readonly T[]): T[] {
  return [...itens].sort((a, b) => {
    const pa = a.prioridade === "alta" ? 0 : 1;
    const pb = b.prioridade === "alta" ? 0 : 1;
    if (pa !== pb) return pa - pb;
    return a.created_at.localeCompare(b.created_at);
  });
}

/** Posição de cada pedido na fila da sua especialidade (1 = próximo a ser chamado). */
export function posicoesNaFila(itens: readonly ItemFila[]): Map<string, number> {
  const cont = new Map<string, number>();
  const pos = new Map<string, number>();
  for (const i of ordenarFila(itens)) {
    const n = (cont.get(i.especialidade_id) ?? 0) + 1;
    cont.set(i.especialidade_id, n);
    pos.set(i.id, n);
  }
  return pos;
}

export function diasAguardando(createdAt: string, hoje = new Date()): number {
  return Math.max(0, differenceInCalendarDays(hoje, parseISO(createdAt)));
}

/** O pedido combina com o filtro de dia/período? Pedido sem preferência combina com qualquer filtro. */
export function combinaHorario(item: { dias_semana: number[]; periodos: string[] }, dia?: number, periodo?: string) {
  const okDia = !dia || item.dias_semana.length === 0 || item.dias_semana.includes(dia);
  const okPer = !periodo || item.periodos.length === 0 || item.periodos.includes(periodo);
  return okDia && okPer;
}
