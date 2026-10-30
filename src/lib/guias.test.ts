import { describe, expect, it } from "vitest";
import { alertaSessao, avisosGuias, exigeGuia, guiaParaSessao, resumoGlosas, saldoGuia, situacaoGuia, usoPorGuia } from "./guias";

const guia = (p: Partial<{ id: string; status: string; sessoes_autorizadas: number | null; validade: string | null; created_at: string; especialidade_id: string }>) => ({
  id: p.id ?? "g1",
  paciente_id: "pac",
  especialidade_id: p.especialidade_id ?? "fono",
  status: p.status ?? "autorizada",
  sessoes_autorizadas: p.sessoes_autorizadas === undefined ? 10 : p.sessoes_autorizadas,
  validade: p.validade === undefined ? "2026-11-30" : p.validade,
  created_at: p.created_at ?? "2026-10-01T10:00:00Z",
});
const sessao = { paciente_id: "pac", especialidade_id: "fono", data: "2026-10-30" };

describe("saldo da guia", () => {
  it("guia de 10 sessões com 5 usadas: restam 5", () => {
    expect(saldoGuia(guia({}), 5)).toBe(5);
  });
  it("nunca fica negativo", () => {
    expect(saldoGuia(guia({ sessoes_autorizadas: 3 }), 5)).toBe(0);
  });
});

describe("situação da guia", () => {
  const hoje = "2026-10-30";
  it("autorizada sem uso continua Autorizada", () => expect(situacaoGuia(guia({}), 0, hoje)).toBe("autorizada"));
  it("com sessões usadas fica Em uso", () => expect(situacaoGuia(guia({}), 3, hoje)).toBe("em_uso"));
  it("saldo zerado fica Concluída", () => expect(situacaoGuia(guia({}), 10, hoje)).toBe("concluida"));
  it("validade passada com saldo fica Vencida", () => expect(situacaoGuia(guia({ validade: "2026-10-29" }), 2, hoje)).toBe("vencida"));
  it("vence hoje ainda vale", () => expect(situacaoGuia(guia({ validade: hoje }), 2, hoje)).toBe("em_uso"));
  it("faturada fica Faturada", () => expect(situacaoGuia(guia({ status: "faturada" }), 10, hoje)).toBe("faturada"));
});

describe("guia ativa da sessão (baixa automática)", () => {
  it("escolhe a que vence primeiro", () => {
    const g = guiaParaSessao([guia({ id: "a", validade: "2026-12-31" }), guia({ id: "b", validade: "2026-11-15" })], new Map(), sessao);
    expect(g?.id).toBe("b");
  });
  it("pula guia sem saldo", () => {
    const g = guiaParaSessao([guia({ id: "a", validade: "2026-11-15" }), guia({ id: "b", validade: "2026-12-31" })], new Map([["a", 10]]), sessao);
    expect(g?.id).toBe("b");
  });
  it("ignora guia de outra especialidade e guia vencida", () => {
    const g = guiaParaSessao([guia({ id: "a", especialidade_id: "to" }), guia({ id: "b", validade: "2026-10-29" })], new Map(), sessao);
    expect(g).toBeNull();
  });
  it("ignora guia apenas solicitada", () => {
    expect(guiaParaSessao([guia({ status: "solicitada" })], new Map(), sessao)).toBeNull();
  });
});

describe("alerta da sessão na agenda", () => {
  it("sem nenhuma guia: Sem guia", () => expect(alertaSessao([], new Map(), sessao)).toBe("sem_guia"));
  it("só guia solicitada: aguardando autorização", () => expect(alertaSessao([guia({ status: "solicitada" })], new Map(), sessao)).toBe("aguardando_guia"));
  it("guia válida com saldo zerado", () => expect(alertaSessao([guia({})], new Map([["g1", 10]]), sessao)).toBe("saldo_zerado"));
  it("guia autorizada já vencida", () => expect(alertaSessao([guia({ validade: "2026-10-01" })], new Map(), sessao)).toBe("guia_vencida"));
  it("guia válida com saldo: sem alerta", () => expect(alertaSessao([guia({})], new Map([["g1", 9]]), sessao)).toBeNull());
  it("guia vinculada acima do limite", () => expect(alertaSessao([guia({ sessoes_autorizadas: 4 })], new Map([["g1", 5]]), { ...sessao, guia_id: "g1" })).toBe("limite_excedido"));
  it("guia vinculada no limite exato: sem alerta (a própria sessão já foi contada)", () =>
    expect(alertaSessao([guia({ sessoes_autorizadas: 5 })], new Map([["g1", 5]]), { ...sessao, guia_id: "g1" })).toBeNull());
});

describe("avisos de renovação", () => {
  const hoje = "2026-10-30";
  it("avisa guia que vence em 7 dias", () => {
    const a = avisosGuias([guia({ validade: "2026-11-06" })], new Map(), hoje);
    expect(a).toHaveLength(1);
    expect(a[0]?.vence).toBe(true);
  });
  it("não avisa guia que vence em 8 dias com saldo folgado", () => {
    expect(avisosGuias([guia({ validade: "2026-11-07" })], new Map(), hoje)).toHaveLength(0);
  });
  it("avisa quando restam 2 sessões", () => {
    const a = avisosGuias([guia({})], new Map([["g1", 8]]), hoje);
    expect(a[0]?.poucas).toBe(true);
    expect(a[0]?.saldo).toBe(2);
  });
  it("não avisa quando restam 3 sessões", () => expect(avisosGuias([guia({})], new Map([["g1", 7]]), hoje)).toHaveLength(0));
  it("guia concluída não gera aviso", () => expect(avisosGuias([guia({})], new Map([["g1", 10]]), hoje)).toHaveLength(0));
});

describe("quem precisa de guia", () => {
  it("só convênio; liminar (lista de presença + NF) e particular não", () => {
    expect(exigeGuia("convenio")).toBe(true);
    expect(exigeGuia("liminar")).toBe(false);
    expect(exigeGuia("particular")).toBe(false);
    expect(exigeGuia(null)).toBe(false);
  });
});

describe("resumo de glosas", () => {
  it("retido = identificada + em recurso; recuperada e perda à parte", () => {
    const r = resumoGlosas([
      { convenio_id: "amil", status: "identificada", valor: 100, convenio: { nome: "Amil" } },
      { convenio_id: "amil", status: "em_recurso", valor: "50.5" },
      { convenio_id: "amil", status: "recuperada", valor: 30 },
      { convenio_id: "unimed", status: "perda", valor: 20, convenio: { nome: "Unimed" } },
    ]);
    expect(r.total).toEqual({ retido: 150.5, recuperado: 30, perda: 20, total: 200.5 });
    expect(r.porConvenio[0]).toMatchObject({ nome: "Amil", retido: 150.5, recuperado: 30 });
  });
  it("uso por guia ignora linhas sem guia", () => {
    expect([...usoPorGuia([{ guia_id: "a", usadas: 3 }, { guia_id: null, usadas: 9 }])]).toEqual([["a", 3]]);
  });
});
