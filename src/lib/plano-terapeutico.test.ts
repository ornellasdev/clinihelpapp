import { describe, expect, it } from "vitest";
import { aplicarModelo, evolucoesDoPeriodo, resumoDaMeta, serieDaMeta } from "./plano-terapeutico";

const regs = [
  { meta_id: "m1", nivel: 2, data: "2026-10-05" },
  { meta_id: "m1", nivel: 4, data: "2026-10-01" },
  { meta_id: "m1", nivel: 3, data: "2026-10-05" },
  { meta_id: "m2", nivel: 5, data: "2026-10-02" },
];

describe("progresso das metas", () => {
  it("gráfico em ordem de data, só da meta pedida, média no mesmo dia", () => {
    expect(serieDaMeta("m1", regs)).toEqual([
      { data: "2026-10-01", nivel: 4 },
      { data: "2026-10-05", nivel: 2.5 },
    ]);
  });
  it("resumo mostra nível inicial, atual e avanço", () => {
    expect(resumoDaMeta("m1", regs)).toEqual({ sessoes: 2, inicial: 4, atual: 2.5, avanco: -1.5 });
    expect(resumoDaMeta("nada", regs)).toEqual({ sessoes: 0, inicial: null, atual: null, avanco: 0 });
  });
});

describe("modelos de evolução", () => {
  it("texto vazio recebe o modelo; texto existente é preservado", () => {
    expect(aplicarModelo("  ", "A:")).toBe("A:");
    expect(aplicarModelo("Já escrito", "A:")).toBe("Já escrito\n\nA:");
  });
});

describe("relatório do paciente", () => {
  it("inclui só o período (limites inclusivos) e as especialidades escolhidas, da mais antiga para a mais nova", () => {
    const ev = [
      { id: 1, data_atendimento: "2026-10-31", especialidade_id: "fono" },
      { id: 2, data_atendimento: "2026-10-01", especialidade_id: "fono" },
      { id: 3, data_atendimento: "2026-09-30", especialidade_id: "fono" },
      { id: 4, data_atendimento: "2026-10-10", especialidade_id: "to" },
    ];
    expect(evolucoesDoPeriodo(ev, "2026-10-01", "2026-10-31", ["fono"]).map((e) => e.id)).toEqual([2, 1]);
  });
});
