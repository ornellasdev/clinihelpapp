import { describe, expect, it } from "vitest";
import { competenciaDe, diasParaVencer, resumoLiminar, sessoesForaDoFechamento, situacaoFatura, vencimentoNF } from "./liminar";

describe("vencimento da NF da liminar", () => {
  it("vence 30 dias após a emissão", () => expect(vencimentoNF("2026-10-30")).toBe("2026-11-29"));
  it("atravessa o fim do ano", () => expect(vencimentoNF("2026-12-15")).toBe("2027-01-14"));
  it("fevereiro", () => expect(vencimentoNF("2027-02-01")).toBe("2027-03-03"));
  it("conta dias até vencer", () => {
    expect(diasParaVencer("2026-11-29", "2026-10-30")).toBe(30);
    expect(diasParaVencer("2026-11-01", "2026-11-03")).toBe(-2);
  });
});

describe("situação do fechamento", () => {
  const hoje = "2026-11-10";
  it("sem NF = aguardando NF", () => expect(situacaoFatura({ status: "aguardando_nf", vencimento: null }, hoje)).toBe("aguardando_nf"));
  it("NF emitida e dentro do prazo = a receber", () => expect(situacaoFatura({ status: "nf_emitida", vencimento: "2026-11-10" }, hoje)).toBe("a_receber"));
  it("NF emitida e prazo passado = vencida", () => expect(situacaoFatura({ status: "nf_emitida", vencimento: "2026-11-09" }, hoje)).toBe("vencida"));
  it("paga continua paga mesmo após o vencimento", () => expect(situacaoFatura({ status: "paga", vencimento: "2026-10-01" }, hoje)).toBe("paga"));
});

describe("resumo para os indicadores", () => {
  const hoje = "2026-11-10";
  const r = resumoLiminar(
    [
      { status: "aguardando_nf", vencimento: null, valor: 500 },
      { status: "nf_emitida", vencimento: "2026-11-15", valor: 1000 },
      { status: "nf_emitida", vencimento: "2026-12-05", valor: 800 },
      { status: "nf_emitida", vencimento: "2026-11-01", valor: 300 },
      { status: "paga", vencimento: "2026-11-05", valor: 700, valor_pago: 650, pago_em: "2026-11-04" },
      { status: "paga", vencimento: "2026-10-05", valor: 900, valor_pago: 900, pago_em: "2026-10-04" },
    ],
    hoje,
    "2026-11",
  );
  it("a receber inclui as vencidas", () => expect(r.aReceber).toEqual({ n: 3, valor: 2100 }));
  it("vencidas à parte", () => expect(r.vencidas).toEqual({ n: 1, valor: 300 }));
  it("vence nos próximos 7 dias", () => expect(r.venceEm7).toEqual({ n: 1, valor: 1000 }));
  it("aguardando emissão da NF", () => expect(r.aguardandoNf).toEqual({ n: 1, valor: 500 }));
  it("recebido no mês usa o valor pago", () => expect(r.recebidoNoMes).toEqual({ n: 1, valor: 650 }));
});

describe("fechamento do mês", () => {
  it("competência é o dia 1", () => expect(competenciaDe("2026-10")).toBe("2026-10-01"));
  it("só sessões ainda fora de fechamento", () =>
    expect(sessoesForaDoFechamento([{ id: "a", item: null }, { id: "b", item: { fatura_id: "f" } }]).map((s) => s.id)).toEqual(["a"]));
});
