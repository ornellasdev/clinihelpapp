import { describe, expect, it } from "vitest";
import { mensagemLembrete, numeroWhatsapp } from "./lembrete-whatsapp";

describe("lembrete WhatsApp", () => {
  it("normaliza telefone com DDI 55", () => {
    expect(numeroWhatsapp("(11) 98765-4321")).toBe("5511987654321");
    expect(numeroWhatsapp("+55 11 98765-4321")).toBe("5511987654321");
  });
  it("rejeita telefone sem DDD", () => {
    expect(numeroWhatsapp("98765-4321")).toBe("");
  });
  it("mensagem traz criança, horário e pedido de confirmação", () => {
    const m = mensagemLembrete({ responsavel: "Maria Souza", crianca: "Lucas", especialidade: "Fonoaudiologia", profissional: "Camila", clinica: "Clínica X", inicio: new Date(2026, 10, 2, 14, 0) });
    expect(m).toContain("Olá, Maria!");
    expect(m).toContain("Lucas com Camila");
    expect(m).toContain("às 14:00");
    expect(m).toContain("*1* para confirmar");
  });
});
