import { describe, expect, it } from "vitest";
import { calcularRepasse, liquidoClinica } from "./financeiro";
import {
  papeisAtribuiveis,
  podeAgendar,
  podeAlterarMembro,
  podeEscreverEvolucao,
  podeGerirEquipe,
  podeGerirFinanceiro,
  podeVerProntuario,
} from "./permissions";

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

describe("administrador: tudo do master, exceto prontuários", () => {
  it("administrador não vê prontuário de nenhuma especialidade", () => {
    expect(podeVerProntuario(["administrador"], [], PSICO)).toBe(false);
    expect(podeVerProntuario(["administrador"], [], FONO)).toBe(false);
  });
  it("administrador agenda, gere financeiro e equipe", () => {
    expect(podeAgendar(["administrador"])).toBe(true);
    expect(podeGerirFinanceiro(["administrador"])).toBe(true);
    expect(podeGerirEquipe(["administrador"])).toBe(true);
  });
  it("administrador não concede o papel master", () => {
    expect(papeisAtribuiveis(["administrador"])).not.toContain("master");
    expect(papeisAtribuiveis(["master"])).toContain("master");
  });
  it("administrador não altera contas master", () => {
    expect(podeAlterarMembro(["administrador"], ["master"])).toBe(false);
    expect(podeAlterarMembro(["administrador"], ["profissional"])).toBe(true);
    expect(podeAlterarMembro(["master"], ["master"])).toBe(true);
  });
});

import { podeVerAuditoria, veAuditoriaDoProntuario } from "./permissions";
import { areasVisiveis } from "./auditoria";

describe("auditoria", () => {
  it("só master e administrador abrem a auditoria", () => {
    expect(podeVerAuditoria(["master"])).toBe(true);
    expect(podeVerAuditoria(["administrador"])).toBe(true);
    expect(podeVerAuditoria(["financeiro"])).toBe(false);
    expect(podeVerAuditoria(["recepcao"])).toBe(false);
    expect(podeVerAuditoria(["profissional"])).toBe(false);
  });

  it("o administrador não vê registros do prontuário; o master vê", () => {
    expect(veAuditoriaDoProntuario(["administrador"])).toBe(false);
    expect(areasVisiveis(false).map(([k]) => k)).not.toContain("evolucoes");
    expect(veAuditoriaDoProntuario(["master"])).toBe(true);
    expect(areasVisiveis(true).map(([k]) => k)).toContain("evolucoes");
  });
});
