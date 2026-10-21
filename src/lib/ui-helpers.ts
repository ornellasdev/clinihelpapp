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

export const STATUS_AGENDA: Record<string, { label: string; className: string }> = {
  agendado: { label: "Agendado", className: "bg-muted text-muted-foreground" },
  confirmado: { label: "Confirmado", className: "bg-secondary text-secondary-foreground" },
  realizado: { label: "Realizado", className: "bg-success/15 text-success" },
  falta: { label: "Falta", className: "bg-warning/25 text-warning-foreground" },
  cancelado: { label: "Cancelado", className: "bg-destructive/10 text-destructive line-through" },
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
  return msg;
}
