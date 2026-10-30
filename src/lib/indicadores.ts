import { differenceInMinutes, endOfMonth, eachDayOfInterval, getDay, parseISO, startOfMonth } from "date-fns";

export type HorarioFuncionamento = { horaIni: number; horaFim: number; sabado: boolean };
export const HORARIO_PADRAO: HorarioFuncionamento = { horaIni: 8, horaFim: 18, sabado: false };

/** Dias de atendimento do mês (seg–sex, e sábado se a clínica abre). Domingo nunca conta. */
export function diasDeAtendimento(mes: string, sabado: boolean): number {
  const ini = startOfMonth(parseISO(`${mes}-01`));
  return eachDayOfInterval({ start: ini, end: endOfMonth(ini) }).filter((d) => {
    const dia = getDay(d);
    return dia !== 0 && (dia !== 6 || sabado);
  }).length;
}

/** Horas que cada sala fica disponível no mês, pelo horário de funcionamento. */
export function horasDisponiveisPorSala(mes: string, h: HorarioFuncionamento): number {
  return diasDeAtendimento(mes, h.sabado) * Math.max(0, h.horaFim - h.horaIni);
}

type Sessao = { inicio: string; fim: string; status: string };

/** Minutos reservados (faltas contam, porque a sala ficou reservada; cancelados não). */
export function minutosOcupados(itens: readonly Sessao[]): number {
  return itens
    .filter((i) => i.status !== "cancelado")
    .reduce((s, i) => s + Math.max(0, differenceInMinutes(parseISO(i.fim), parseISO(i.inicio))), 0);
}

/** Percentual com uma casa decimal; 0 quando não há base. */
export function percentual(parte: number, total: number): number {
  if (!(total > 0)) return 0;
  return Math.round((parte / total) * 1000) / 10;
}

/** Taxa de faltas = faltas ÷ (faltas + realizados). Agendados e cancelados não entram. */
export function taxaFaltas(itens: readonly { status: string }[]) {
  const faltas = itens.filter((i) => i.status === "falta").length;
  const realizados = itens.filter((i) => i.status === "realizado").length;
  return { faltas, realizados, taxa: percentual(faltas, faltas + realizados) };
}

type SessaoFin = { status: string; fin: { valor: number | string | null; pagamento_status: string } | null };

/**
 * Faturamento = sessões realizadas no mês. Recebido = realizadas já pagas.
 * A receber = realizadas ainda pendentes. Previsto = agendadas/confirmadas que ainda vão acontecer.
 */
export function resumoFinanceiro(itens: readonly SessaoFin[]) {
  let faturado = 0;
  let recebido = 0;
  let aReceber = 0;
  let previsto = 0;
  for (const i of itens) {
    const v = Number(i.fin?.valor ?? 0);
    if (i.status === "realizado") {
      faturado += v;
      if (i.fin?.pagamento_status === "pago") recebido += v;
      else aReceber += v;
    } else if (i.status === "agendado" || i.status === "confirmado") {
      previsto += v;
    }
  }
  const r = (n: number) => Math.round(n * 100) / 100;
  return { faturado: r(faturado), recebido: r(recebido), aReceber: r(aReceber), previsto: r(previsto) };
}
