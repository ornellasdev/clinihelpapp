import { describe, expect, it } from "vitest";
import { gerarCsv, montarLinhas, totalizar } from "./exportar-financeiro";

const base = {
  inicio: "2026-10-05T14:30:00",
  status: "finalizado",
  paciente: { nome: "Ana; Souza" },
  profissional: { nome: "Dra. Lia" },
  especialidade: { nome: "Psicologia" },
  fin: { valor: "150", percentual_repasse: "60", pagamento_status: "pago", repasse_pago: false },
};

describe("exportação financeira", () => {
  it("usa o percentual da sessão para repasse e líquido", () => {
    const l = montarLinhas([base], (s) => s)[0]!;
    expect(l.repasse).toBe(90);
    expect(l.liquido).toBe(60);
    expect(l.pagoPaciente).toBe("Sim");
    expect(l.repassePago).toBe("Não");
  });
  it("falta não cobrada sai com valor e repasse zerados; falta cobrada sem repasse só zera o repasse", () => {
    const [semCobranca, semRepasse] = montarLinhas(
      [
        { ...base, status: "falta_justificada", fin: { ...base.fin, cobrar: false, repassar: false } },
        { ...base, status: "falta_cobrada", fin: { ...base.fin, cobrar: true, repassar: false } },
      ],
      (s) => s,
    );
    expect([semCobranca!.valor, semCobranca!.repasse, semCobranca!.liquido]).toEqual([0, 0, 0]);
    expect([semRepasse!.valor, semRepasse!.repasse, semRepasse!.liquido]).toEqual([150, 0, 150]);
  });
  it("soma os totais das linhas exportadas", () => {
    const linhas = montarLinhas([base, { ...base, fin: { ...base.fin, valor: 200, percentual_repasse: 50 } }], (s) => s);
    expect(totalizar(linhas)).toEqual({ valor: 350, repasse: 190, liquido: 160 });
  });
  it("CSV usa ponto e vírgula, vírgula decimal e protege textos com ;", () => {
    const csv = gerarCsv(montarLinhas([base], () => "Realizado"));
    const linha = csv.split("\r\n")[1];
    expect(linha).toContain('"Ana; Souza"');
    expect(linha).toContain(";150,00;60,00;90,00;60,00;Sim;Não");
  });
});

describe("CSV seguro contra fórmulas", () => {
  it("neutraliza nomes que começam com = + - @", () => {
    const linhas = montarLinhas(
      [{ ...base, paciente: { nome: '=HYPERLINK("http://x")' }, profissional: { nome: "@SUM(A1)" } }],
      () => "Realizado",
    );
    const csv = gerarCsv(linhas);
    expect(csv).toContain(`"'=HYPERLINK(""http://x"")"`);
    expect(csv).toContain("'@SUM(A1)");
    expect(csv).not.toMatch(/;=|;@/);
  });
});
