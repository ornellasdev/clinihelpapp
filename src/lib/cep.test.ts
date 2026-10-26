import { describe, expect, it } from "vitest";
import { enderecoDeViaCep, formatarCep } from "./cep";

describe("CEP", () => {
  it("aplica a máscara 00000-000 e ignora o que não é número", () => {
    expect(formatarCep("01001000")).toBe("01001-000");
    expect(formatarCep("01.001-000123")).toBe("01001-000");
  });

  it("preenche endereço com rua e bairro, município, estado e país", () => {
    expect(
      enderecoDeViaCep("01001000", { logradouro: "Praça da Sé", bairro: "Sé", localidade: "São Paulo", uf: "SP", estado: "São Paulo" }),
    ).toEqual({ cep: "01001-000", endereco: "Praça da Sé - Sé", cidade: "São Paulo", estado: "São Paulo", uf: "SP", pais: "Brasil" });
  });

  it("retorna nada quando o CEP não existe", () => {
    expect(enderecoDeViaCep("99999999", { erro: "true" })).toBeNull();
  });
});
