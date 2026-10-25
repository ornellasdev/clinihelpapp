import { describe, expect, it } from "vitest";
import { gerarCsv, montarLinhas, totalizar } from "./exportar-financeiro";

const base = {
  inicio: "2026-10-05T14:30:00",
  status: "realizado",
  paciente: { nome: "Ana; Souza" },
  profissional: { nome: "Dra. Lia" },
  especialidade: { nome: "Psicologia" },
  fin: { valor: "150", percentual_repasse: "60", pagamento_status: "pago", repasse_pago: false },
};

describe("exportação financeira", () => {
  it("usa o percentual da sessão para repasse e líquido", () => {
    const [l] = montarLinhas([base], (s) => s);
    expect(l.repasse).toBe(90);
    expect(l.liquido).toBe(60);
    expect(l.pagoPaciente).toBe("Sim");
    expect(l.repassePago).toBe("Não");
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
