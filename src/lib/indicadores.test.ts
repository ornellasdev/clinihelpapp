import { describe, expect, it } from "vitest";
import { diasDeAtendimento, horasDisponiveisPorSala, minutosOcupados, percentual, resumoFinanceiro, taxaFaltas } from "./indicadores";
import { combinaHorario, ordenarFila, posicoesNaFila } from "./lista-espera";

describe("ocupação das salas", () => {
  it("conta dias úteis do mês, com e sem sábado (outubro/2026)", () => {
    expect(diasDeAtendimento("2026-10", false)).toBe(22);
    expect(diasDeAtendimento("2026-10", true)).toBe(27);
  });
  it("horas disponíveis = dias × horas abertas", () => {
    expect(horasDisponiveisPorSala("2026-10", { horaIni: 8, horaFim: 18, sabado: false })).toBe(220);
  });
  it("faltas ocupam a sala, cancelados não", () => {
    const itens = [
      { inicio: "2026-10-01T08:00:00Z", fim: "2026-10-01T08:50:00Z", status: "realizado" },
      { inicio: "2026-10-01T09:00:00Z", fim: "2026-10-01T09:50:00Z", status: "falta" },
      { inicio: "2026-10-01T10:00:00Z", fim: "2026-10-01T10:50:00Z", status: "cancelado" },
    ];
    expect(minutosOcupados(itens)).toBe(100);
  });
  it("percentual sem base é zero", () => {
    expect(percentual(5, 0)).toBe(0);
    expect(percentual(1, 3)).toBe(33.3);
  });
});

describe("faltas", () => {
  it("taxa = faltas ÷ (faltas + realizados)", () => {
    const r = taxaFaltas([{ status: "falta" }, { status: "realizado" }, { status: "realizado" }, { status: "realizado" }, { status: "agendado" }, { status: "cancelado" }]);
    expect(r).toEqual({ faltas: 1, realizados: 3, taxa: 25 });
  });
});

describe("faturamento e valores a receber", () => {
  it("só sessões realizadas faturam; pendentes ficam a receber; agendadas são previsão", () => {
    const r = resumoFinanceiro([
      { status: "realizado", fin: { valor: 150, pagamento_status: "pago" } },
      { status: "realizado", fin: { valor: "120", pagamento_status: "pendente" } },
      { status: "falta", fin: { valor: 150, pagamento_status: "pendente" } },
      { status: "agendado", fin: { valor: 100, pagamento_status: "pendente" } },
      { status: "cancelado", fin: { valor: 100, pagamento_status: "pendente" } },
    ]);
    expect(r).toEqual({ faturado: 270, recebido: 150, aReceber: 120, previsto: 100 });
  });
});

describe("lista de espera", () => {
  const base = [
    { id: "a", especialidade_id: "fono", prioridade: "normal", created_at: "2026-01-01T00:00:00Z" },
    { id: "b", especialidade_id: "fono", prioridade: "alta", created_at: "2026-03-01T00:00:00Z" },
    { id: "c", especialidade_id: "psico", prioridade: "normal", created_at: "2026-02-01T00:00:00Z" },
  ];
  it("prioridade alta passa na frente; depois quem entrou primeiro", () => {
    expect(ordenarFila(base).map((i) => i.id)).toEqual(["b", "a", "c"]);
  });
  it("cada especialidade tem a sua fila", () => {
    const p = posicoesNaFila(base);
    expect([p.get("b"), p.get("a"), p.get("c")]).toEqual([1, 2, 1]);
  });
  it("filtro de dia/período respeita a preferência; sem preferência aceita qualquer horário", () => {
    expect(combinaHorario({ dias_semana: [2, 4], periodos: ["tarde"] }, 2, "tarde")).toBe(true);
    expect(combinaHorario({ dias_semana: [2, 4], periodos: ["tarde"] }, 3)).toBe(false);
    expect(combinaHorario({ dias_semana: [], periodos: [] }, 5, "manha")).toBe(true);
  });
});
