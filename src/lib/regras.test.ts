import { describe, expect, it } from "vitest";
import { calcularRepasse, liquidoClinica } from "./financeiro";
import { podeEscreverEvolucao, podeVerProntuario, podeGerirFinanceiro, podeAgendar } from "./permissions";

const PSICO = "esp-psicologia";
const FONO = "esp-fono";

describe("repasse por sessão", () => {
  it("aplica o percentual ajustado da sessão sobre o valor", () => {
    expect(calcularRepasse(150, 60)).toBe(90);
    expect(liquidoClinica(150, 60)).toBe(60);
  });
  it("percentual diferente na mesma sessão muda o repasse", () => {
    expect(calcularRepasse(200, 45.5)).toBe(91);
  });
  it("limita o percentual entre 0 e 100", () => {
    expect(calcularRepasse(100, 150)).toBe(100);
    expect(calcularRepasse(100, -10)).toBe(0);
  });
});

describe("acesso ao prontuário por especialidade", () => {
  it("psicologia é visível para a psicóloga", () => {
    expect(podeVerProntuario(["profissional"], [PSICO], PSICO)).toBe(true);
  });
  it("psicologia não é visível para a fonoaudióloga", () => {
    expect(podeVerProntuario(["profissional"], [FONO], PSICO)).toBe(false);
  });
  it("master vê psicologia mesmo sem a especialidade", () => {
    expect(podeVerProntuario(["master"], [], PSICO)).toBe(true);
  });
  it("recepção não vê prontuário", () => {
    expect(podeVerProntuario(["recepcao"], [], PSICO)).toBe(false);
  });
  it("só quem é da especialidade escreve evolução", () => {
    expect(podeEscreverEvolucao([PSICO], PSICO)).toBe(true);
    expect(podeEscreverEvolucao([], PSICO)).toBe(false);
  });
});

describe("separação de funções", () => {
  it("recepção agenda mas não mexe no financeiro", () => {
    expect(podeAgendar(["recepcao"])).toBe(true);
    expect(podeGerirFinanceiro(["recepcao"])).toBe(false);
  });
  it("financeiro gere valores mas não agenda", () => {
    expect(podeGerirFinanceiro(["financeiro"])).toBe(true);
    expect(podeAgendar(["financeiro"])).toBe(false);
  });
});
