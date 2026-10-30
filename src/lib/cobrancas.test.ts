import { describe, expect, it } from "vitest";
import { billingTypeAsaas, cpfValido, efeitoNasSessoes, pagadorDoPaciente, statusDoAsaas, tipoPorSessoes } from "./cobrancas";

describe("cobranças aos responsáveis", () => {
  it("pagamento confirmado ou recebido no Asaas conta como pago", () => {
    expect(statusDoAsaas("CONFIRMED")).toBe("pago");
    expect(statusDoAsaas("RECEIVED")).toBe("pago");
    expect(statusDoAsaas("OVERDUE")).toBe("vencido");
    expect(statusDoAsaas("PENDING", true)).toBe("cancelada");
  });

  it("sessão fica paga quando a cobrança é paga e volta a pendente se estornada", () => {
    expect(efeitoNasSessoes("pendente", "pago")).toBe("pago");
    expect(efeitoNasSessoes("pago", "estornado")).toBe("pendente");
    expect(efeitoNasSessoes("pendente", "vencido")).toBeNull();
  });

  it("uma sessão = por sessão, várias = mensal, nenhuma = valor livre", () => {
    expect(tipoPorSessoes(1)).toBe("sessao");
    expect(tipoPorSessoes(4)).toBe("mensal");
    expect(tipoPorSessoes(0)).toBe("avulsa");
  });

  it("responsável escolhe a forma quando a clínica deixa todas", () => {
    expect(billingTypeAsaas("todas")).toBe("UNDEFINED");
    expect(billingTypeAsaas("pix")).toBe("PIX");
    expect(billingTypeAsaas("cartao")).toBe("CREDIT_CARD");
  });

  it("paga o responsável financeiro; sem ele, o responsável principal", () => {
    const base = { responsavel_nome: "Maria", responsavel_cpf: "529.982.247-25" };
    expect(pagadorDoPaciente({ ...base, responsavel_financeiro_nome: "João", responsavel_financeiro_cpf: "111.444.777-35" })).toMatchObject({ nome: "João", cpf: "11144477735" });
    expect(pagadorDoPaciente(base)).toMatchObject({ nome: "Maria", cpf: "52998224725", origem: "principal" });
  });

  it("valida CPF pelos dígitos verificadores", () => {
    expect(cpfValido("529.982.247-25")).toBe(true);
    expect(cpfValido("529.982.247-24")).toBe(false);
    expect(cpfValido("111.111.111-11")).toBe(false);
  });
});
