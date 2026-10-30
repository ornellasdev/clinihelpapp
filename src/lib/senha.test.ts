import { describe, expect, it } from "vitest";
import { gerarSenhaTemporaria, senhaForte } from "./senha";

describe("senha segura", () => {
  it("aceita senha com 8+ caracteres, maiúscula, minúscula, número e especial", () => {
    expect(senhaForte("Clinica#2026")).toBe(true);
    expect(senhaForte("Ab1!efgh")).toBe(true);
  });
  it("recusa menos de 8 caracteres", () => {
    expect(senhaForte("Ab1!efg")).toBe(false);
  });
  it("recusa sem letra maiúscula", () => {
    expect(senhaForte("clinica#2026")).toBe(false);
  });
  it("recusa sem letra minúscula", () => {
    expect(senhaForte("CLINICA#2026")).toBe(false);
  });
  it("recusa sem número", () => {
    expect(senhaForte("Clinica#Help")).toBe(false);
  });
  it("recusa sem caractere especial", () => {
    expect(senhaForte("Clinica2026")).toBe(false);
  });
  it("recusa espaços", () => {
    expect(senhaForte("Clinica #2026")).toBe(false);
  });
  it("recusa mais de 72 caracteres", () => {
    expect(senhaForte(`Aa1!${"x".repeat(69)}`)).toBe(false);
  });
  it("senha temporária gerada sempre cumpre as regras", () => {
    for (let i = 0; i < 200; i++) expect(senhaForte(gerarSenhaTemporaria())).toBe(true);
  });
});
