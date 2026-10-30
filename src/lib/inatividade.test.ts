import { describe, expect, it } from "vitest";
import { LIMITE_INATIVIDADE_MS, segundosParaSair, situacaoInatividade } from "./inatividade";

const MIN = 60_000;

describe("saída automática por inatividade", () => {
  it("o limite é de 15 minutos", () => {
    expect(LIMITE_INATIVIDADE_MS).toBe(15 * MIN);
  });

  it("encerra a sessão com 15 minutos parado", () => {
    expect(situacaoInatividade(0, 15 * MIN)).toBe("expirado");
  });

  it("avisa no último minuto antes de sair", () => {
    expect(situacaoInatividade(0, 14 * MIN)).toBe("aviso");
    expect(segundosParaSair(0, 14 * MIN + 30_000)).toBe(30);
  });

  it("com menos de 14 minutos parado continua normal", () => {
    expect(situacaoInatividade(0, 14 * MIN - 1)).toBe("ativo");
  });
});
