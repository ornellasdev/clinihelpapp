import { describe, expect, it } from "vitest";
import { gerarSlug, slugValido } from "./clinica-slug";

describe("endereço da clínica", () => {
  it("gera o endereço a partir do nome, sem acentos e com hífens", () => {
    expect(gerarSlug("Clínica Sol & Mar")).toBe("clinica-sol-mar");
  });

  it("não aceita endereços que já são páginas do sistema", () => {
    expect(slugValido("auth")).toBe(false);
    expect(slugValido("dev")).toBe(false);
  });

  it("aceita letras minúsculas, números e hífens", () => {
    expect(slugValido("clinica-sol-2")).toBe(true);
    expect(slugValido("Clinica Sol")).toBe(false);
  });
});
