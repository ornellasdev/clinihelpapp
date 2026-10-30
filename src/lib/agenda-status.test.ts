import { describe, expect, it } from "vitest";
import { ehFaltaDoPaciente, ehFaturavel, iniciaAoAbrirEvolucao, ordemFila, regraFinanceira } from "./agenda-status";

describe("regraFinanceira", () => {
  it("finalizado cobra, repassa e desconta a guia", () => {
    expect(regraFinanceira("finalizado")).toEqual({ cobrar: true, repassar: true, descontaGuia: true });
  });
  it("falta justificada não cobra, não repassa e não desconta", () => {
    expect(regraFinanceira("falta_justificada")).toEqual({ cobrar: false, repassar: false, descontaGuia: false });
  });
  it("falta do terapeuta não cobra, não repassa e não desconta", () => {
    expect(regraFinanceira("falta_terapeuta")).toEqual({ cobrar: false, repassar: false, descontaGuia: false });
  });
  it("falta não justificada cobra e não desconta a guia; repasse padrão é sim", () => {
    expect(regraFinanceira("falta_cobrada")).toEqual({ cobrar: true, repassar: true, descontaGuia: false });
    expect(regraFinanceira("falta_cobrada", null)).toEqual({ cobrar: true, repassar: true, descontaGuia: false });
  });
  it("falta não justificada sem repasse quando a clínica decide", () => {
    expect(regraFinanceira("falta_cobrada", false)).toEqual({ cobrar: true, repassar: false, descontaGuia: false });
  });
  it("aguardando e em atendimento ainda não descontam a guia", () => {
    expect(regraFinanceira("aguardando").descontaGuia).toBe(false);
    expect(regraFinanceira("em_atendimento").descontaGuia).toBe(false);
  });
});

describe("faturamento e faltas", () => {
  it("só finalizado e falta cobrada entram no faturamento", () => {
    expect(["agendado", "aguardando", "em_atendimento", "finalizado", "falta_justificada", "falta_terapeuta", "falta_cobrada", "cancelado"].filter(ehFaturavel)).toEqual([
      "finalizado",
      "falta_cobrada",
    ]);
  });
  it("falta do terapeuta não conta como falta do paciente", () => {
    expect(ehFaltaDoPaciente("falta_terapeuta")).toBe(false);
    expect(ehFaltaDoPaciente("falta_justificada")).toBe(true);
    expect(ehFaltaDoPaciente("falta_cobrada")).toBe(true);
  });
});

describe("fila do terapeuta", () => {
  it("em atendimento primeiro, depois aguardando, depois por horário", () => {
    const itens = [
      { id: "a", status: "agendado", inicio: "2026-10-30T08:00:00Z" },
      { id: "b", status: "aguardando", inicio: "2026-10-30T10:00:00Z" },
      { id: "c", status: "em_atendimento", inicio: "2026-10-30T09:00:00Z" },
      { id: "d", status: "finalizado", inicio: "2026-10-30T07:00:00Z" },
      { id: "e", status: "aguardando", inicio: "2026-10-30T09:30:00Z" },
    ];
    expect([...itens].sort(ordemFila).map((i) => i.id)).toEqual(["c", "e", "b", "a", "d"]);
  });
  it("abrir a evolução inicia o atendimento só se ainda não começou", () => {
    expect(iniciaAoAbrirEvolucao("aguardando")).toBe(true);
    expect(iniciaAoAbrirEvolucao("agendado")).toBe(true);
    expect(iniciaAoAbrirEvolucao("em_atendimento")).toBe(false);
    expect(iniciaAoAbrirEvolucao("finalizado")).toBe(false);
    expect(iniciaAoAbrirEvolucao("falta_cobrada")).toBe(false);
  });
});
