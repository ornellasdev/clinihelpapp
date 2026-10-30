import { describe, expect, it } from "vitest";
import { decisoesDoTipo, emailsDosResponsaveis, formatarCpf, preencherTermo, validarAssinatura } from "./familia";

describe("acesso dos responsáveis", () => {
  it("todos os três responsáveis da ficha entram, sem repetir e ignorando e-mail vazio ou inválido", () => {
    expect(
      emailsDosResponsaveis({ responsavel_email: " Mae@Ex.com ", responsavel2_email: "pai@ex.com", responsavel_financeiro_email: "mae@ex.com" }),
    ).toEqual(["mae@ex.com", "pai@ex.com"]);
    expect(emailsDosResponsaveis({ responsavel_email: "", responsavel2_email: "sem-arroba", responsavel_financeiro_email: null })).toEqual([]);
  });
});

describe("termos", () => {
  it("preenche nome da criança e da clínica", () => {
    expect(preencherTermo("{{crianca}} na {{clinica}} / {{crianca}}", { crianca: "Lucas", clinica: "Clínica X" })).toBe("Lucas na Clínica X / Lucas");
  });
  it("termo de imagem pede autorizo/não autorizo; os outros só concordo", () => {
    expect(decisoesDoTipo("imagem")).toEqual(["autorizo", "nao_autorizo"]);
    expect(decisoesDoTipo("tratamento")).toEqual(["concordo"]);
  });
  it("assinatura exige nome completo, CPF válido, parentesco, decisão do tipo e desenho", () => {
    const ok = { nome: "Maria Souza", cpf: "529.982.247-25", parentesco: "Mãe", decisao: "concordo", tipo: "tratamento", assinatura: "data:image/png;base64," + "A".repeat(900) };
    expect(validarAssinatura(ok)).toBeNull();
    expect(validarAssinatura({ ...ok, nome: "Maria" })).toBe("Escreva seu nome completo.");
    expect(validarAssinatura({ ...ok, cpf: "111.111.111-11" })).toBe("CPF inválido.");
    expect(validarAssinatura({ ...ok, decisao: "autorizo" })).toBe("Escolha uma opção do termo.");
    expect(validarAssinatura({ ...ok, assinatura: "data:image/png;base64,AAAA" })).toBe("Faça sua assinatura no quadro.");
  });
  it("formata CPF", () => {
    expect(formatarCpf("52998224725")).toBe("529.982.247-25");
  });
});
