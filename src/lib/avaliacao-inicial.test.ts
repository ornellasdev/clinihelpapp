import { describe, expect, it } from "vitest";
import { bloqueiaAgendamento, etapaAvaliacao, mensagemFormularioDisponivel, motivoSemCobrancaAvaliacao } from "./avaliacao-inicial";

describe("avaliação inicial", () => {
  it("bloqueia a 1ª consulta enquanto o pagamento está pendente", () => {
    expect(bloqueiaAgendamento("aguardando_pagamento")).toBe(true);
  });
  it("bloqueia a 1ª consulta enquanto o formulário não foi preenchido", () => {
    expect(bloqueiaAgendamento("aguardando_formulario")).toBe(true);
  });
  it("libera o agendamento com pagamento e formulário concluídos", () => {
    expect(bloqueiaAgendamento("concluida")).toBe(false);
  });
  it("pacientes antigos/importados (sem avaliação) agendam normalmente", () => {
    expect(bloqueiaAgendamento(undefined)).toBe(false);
    expect(bloqueiaAgendamento("dispensada")).toBe(false);
  });
  it("só gera cobrança da avaliação enquanto o pagamento está pendente", () => {
    expect(motivoSemCobrancaAvaliacao("aguardando_pagamento", null)).toBeNull();
    expect(motivoSemCobrancaAvaliacao("aguardando_formulario", null)).toMatch(/já foi confirmado/);
  });
  it("não gera segunda cobrança com uma em aberto, mas permite após vencida ou cancelada", () => {
    expect(motivoSemCobrancaAvaliacao("aguardando_pagamento", "pendente")).toMatch(/em aberto/);
    expect(motivoSemCobrancaAvaliacao("aguardando_pagamento", "cancelada")).toBeNull();
    expect(motivoSemCobrancaAvaliacao("aguardando_pagamento", "vencido")).toBeNull();
  });
  it("etapas seguem pagamento → formulário → agendar", () => {
    expect([etapaAvaliacao("aguardando_pagamento"), etapaAvaliacao("aguardando_formulario"), etapaAvaliacao("concluida")]).toEqual([0, 1, 2]);
  });
  it("aviso aos pais traz o link da Área da família e o e-mail de acesso", () => {
    const m = mensagemFormularioDisponivel({ responsavel: "Ana Souza", crianca: "Léo", clinica: "Clínica Sol", email: "ana@x.com" });
    expect(m).toContain("https://clinihelpsystem.lovable.app/familia");
    expect(m).toContain("ana@x.com");
    expect(m.startsWith("Olá, Ana!")).toBe(true);
  });
});
