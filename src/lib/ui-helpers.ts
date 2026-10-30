import type { StatusAgenda } from "./agenda-status";
import { differenceInMonths, differenceInYears, format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

export const COR_ESPECIALIDADE: Record<string, string> = {
  "chart-1": "bg-chart-1/15 text-chart-1 border-chart-1/30",
  "chart-2": "bg-chart-2/15 text-chart-2 border-chart-2/30",
  "chart-3": "bg-chart-3/15 text-chart-3 border-chart-3/30",
  "chart-4": "bg-chart-4/15 text-chart-4 border-chart-4/30",
  "chart-5": "bg-chart-5/20 text-warning-foreground border-chart-5/40",
};
export const BARRA_ESPECIALIDADE: Record<string, string> = {
  "chart-1": "border-l-chart-1",
  "chart-2": "border-l-chart-2",
  "chart-3": "border-l-chart-3",
  "chart-4": "border-l-chart-4",
  "chart-5": "border-l-chart-5",
};
export const corEsp = (cor?: string | null) => COR_ESPECIALIDADE[cor ?? "chart-1"] ?? COR_ESPECIALIDADE["chart-1"];
export const barraEsp = (cor?: string | null) => BARRA_ESPECIALIDADE[cor ?? "chart-1"] ?? BARRA_ESPECIALIDADE["chart-1"];

export type { StatusAgenda } from "./agenda-status";

/**
 * Cores por status: azul = agendado, laranja = aguardando, roxo = em atendimento, verde = finalizado,
 * cinza = faltas não cobradas, vermelho = falta não justificada (cobrada).
 * className = etiqueta; bloco = cartão na grade da agenda.
 */
export const STATUS_AGENDA: Record<StatusAgenda, { label: string; curto: string; className: string; bloco: string; ponto: string }> = {
  agendado: { label: "Agendado", curto: "Agendado", className: "bg-status-agendado/15 text-status-agendado", bloco: "bg-status-agendado/10 border-status-agendado/45", ponto: "bg-status-agendado" },
  aguardando: { label: "Aguardando atendimento", curto: "Aguardando", className: "bg-status-aguardando/25 text-warning-foreground", bloco: "bg-status-aguardando/20 border-status-aguardando/70", ponto: "bg-status-aguardando" },
  em_atendimento: { label: "Em atendimento", curto: "Em atendimento", className: "bg-status-atendimento/15 text-status-atendimento", bloco: "bg-status-atendimento/15 border-status-atendimento/60", ponto: "bg-status-atendimento" },
  finalizado: { label: "Finalizado", curto: "Finalizado", className: "bg-status-finalizado/15 text-status-finalizado", bloco: "bg-status-finalizado/12 border-status-finalizado/50", ponto: "bg-status-finalizado" },
  falta_justificada: { label: "Falta justificada", curto: "Falta justif.", className: "bg-status-sem-cobranca/15 text-status-sem-cobranca", bloco: "bg-status-sem-cobranca/12 border-status-sem-cobranca/45", ponto: "bg-status-sem-cobranca" },
  falta_terapeuta: { label: "Falta do terapeuta", curto: "Falta terapeuta", className: "bg-status-sem-cobranca/15 text-status-sem-cobranca", bloco: "bg-status-sem-cobranca/12 border-status-sem-cobranca/45", ponto: "bg-status-sem-cobranca" },
  falta_cobrada: { label: "Falta não justificada", curto: "Falta cobrada", className: "bg-status-falta/15 text-status-falta", bloco: "bg-status-falta/12 border-status-falta/55", ponto: "bg-status-falta" },
  cancelado: { label: "Cancelado", curto: "Cancelado", className: "bg-muted text-muted-foreground line-through", bloco: "bg-muted border-border opacity-50", ponto: "bg-muted-foreground" },
};

export function idade(dataNascimento?: string | null) {
  if (!dataNascimento) return "";
  const d = parseISO(dataNascimento);
  const anos = differenceInYears(new Date(), d);
  if (anos >= 2) return `${anos} anos`;
  const meses = differenceInMonths(new Date(), d);
  return `${meses} ${meses === 1 ? "mês" : "meses"}`;
}

export const fmtData = (iso: string, padrao = "dd/MM/yyyy") => format(parseISO(iso), padrao, { locale: ptBR });
export const fmtHora = (iso: string) => format(parseISO(iso), "HH:mm");

export function iniciais(nome: string) {
  return nome
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

export function erroAmigavel(msg: string) {
  if (msg.includes("sala_sem_conflito")) return "Esta sala já está ocupada nesse horário.";
  if (msg.includes("profissional_sem_conflito")) return "O profissional já tem atendimento nesse horário.";
  if (msg.includes("row-level security")) return "Seu perfil não tem permissão para esta ação.";
  if (msg.toLowerCase().includes("already been registered")) return "Já existe um usuário com este e-mail.";
  if (msg.includes("Invalid login credentials")) return "E-mail ou senha incorretos.";
  if (msg.toLowerCase().includes("weak and easy to guess")) return "Senha muito fácil de adivinhar. Use letras, números e símbolos.";
  if (msg.includes("outra clínica")) return "Esse registro pertence a outra clínica.";
  return msg;
}
