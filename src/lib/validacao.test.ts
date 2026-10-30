import { describe, expect, it } from "vitest";
import {
  REGRA_ATESTADO,
  codigoOperadoraValido,
  cpfOpcional,
  dataPassadaValida,
  formatarCpf,
  normalizarTuss,
  problemaNoArquivo,
  telefoneValido,
  tussValido,
  valorMonetarioValido,
} from "./validacao";

describe("CPF", () => {
  it("aceita CPF com dígitos verificadores corretos e formata", () => {
    const r = cpfOpcional().safeParse("52998224725");
    expect(r.success && r.data).toBe("529.982.247-25");
  });
  it("recusa CPF com dígito verificador errado", () => {
    expect(cpfOpcional().safeParse("529.982.247-24").success).toBe(false);
  });
  it("recusa CPF com todos os dígitos iguais", () => {
    expect(cpfOpcional().safeParse("111.111.111-11").success).toBe(false);
  });
  it("campo vazio vira null (CPF não é obrigatório)", () => {
    const r = cpfOpcional().safeParse("  ");
    expect(r.success && r.data).toBe(null);
  });
  it("formatarCpf mantém o texto se não tiver 11 dígitos", () => {
    expect(formatarCpf("123")).toBe("123");
  });
});

describe("códigos de convênio", () => {
  it("TUSS tem 8 dígitos (pontos e traços ignorados)", () => {
    expect(tussValido("50000470")).toBe(true);
    expect(tussValido("5000.0470")).toBe(true);
    expect(normalizarTuss("5000.0470")).toBe("50000470");
    expect(tussValido("5000047")).toBe(false);
    expect(tussValido("50000470A")).toBe(false);
  });
  it("número da guia aceita letras, números, ponto, traço e barra até 60 caracteres", () => {
    expect(codigoOperadoraValido("G-2024/00123")).toBe(true);
    expect(codigoOperadoraValido("guia#1")).toBe(false);
    expect(codigoOperadoraValido("A".repeat(61))).toBe(false);
  });
});

describe("valores e datas", () => {
  it("valor em reais: não negativo, até 1 milhão, 2 casas", () => {
    expect(valorMonetarioValido(150.5)).toBe(true);
    expect(valorMonetarioValido(-1)).toBe(false);
    expect(valorMonetarioValido(10.123)).toBe(false);
    expect(valorMonetarioValido(1_000_000.01)).toBe(false);
  });
  it("data de nascimento não pode ser futura", () => {
    const hoje = new Date("2026-10-30T12:00:00");
    expect(dataPassadaValida("2026-10-30", hoje)).toBe(true);
    expect(dataPassadaValida("2026-10-31", hoje)).toBe(false);
    expect(dataPassadaValida("1899-12-31", hoje)).toBe(false);
  });
  it("telefone com DDD", () => {
    expect(telefoneValido("(11) 98765-4321")).toBe(true);
    expect(telefoneValido("98765-4321")).toBe(false);
  });
});

describe("arquivos de atestado", () => {
  it("aceita PDF até 15 MB", () => {
    expect(problemaNoArquivo({ name: "a.pdf", size: 1000, type: "application/pdf" }, REGRA_ATESTADO)).toBeNull();
  });
  it("recusa outros formatos e arquivos maiores que 15 MB", () => {
    expect(problemaNoArquivo({ name: "a.docx", size: 1000, type: "application/msword" }, REGRA_ATESTADO)).not.toBeNull();
    expect(problemaNoArquivo({ name: "a.pdf", size: 15 * 1024 * 1024 + 1, type: "application/pdf" }, REGRA_ATESTADO)).not.toBeNull();
  });
});
