import { describe, expect, it } from "vitest";
import { MODULOS, moduloPorId } from "./conteudo";
import { corrigir, modulosDaTrilha, progressoDaTrilha, situacaoDoTopico, type ResultadoTreinamento } from "./trilha";

const ids = (papeis: Parameters<typeof modulosDaTrilha>[0]) => modulosDaTrilha(papeis).map((m) => m.id);
const res = (modulo_id: string, acertos: number, total: number, versao = 1): ResultadoTreinamento => ({
  user_id: "u",
  modulo_id,
  versao,
  acertos,
  total,
  aprovado: acertos / total >= 0.7,
  created_at: "2026-10-30T12:00:00Z",
});

describe("trilha por cargo", () => {
  it("todo cargo faz os tópicos essenciais de segurança e LGPD", () => {
    for (const p of ["recepcao", "profissional", "financeiro", "administrador", "master"] as const) {
      expect(ids([p])).toEqual(expect.arrayContaining(["acesso-seguranca", "lgpd-sigilo"]));
    }
  });
  it("recepção aprende agenda, faltas, cadastro e guias, mas não prontuário nem cobranças", () => {
    const r = ids(["recepcao"]);
    expect(r).toEqual(expect.arrayContaining(["agenda", "faltas", "cadastro-paciente", "guias", "lista-espera", "familia-termos"]));
    expect(r).not.toContain("prontuario");
    expect(r).not.toContain("cobrancas");
  });
  it("profissional aprende prontuário e plano terapêutico, mas não financeiro da clínica", () => {
    const r = ids(["profissional"]);
    expect(r).toEqual(expect.arrayContaining(["meus-atendimentos", "prontuario", "plano-terapeutico"]));
    expect(r).not.toContain("financeiro-sessoes");
    expect(r).not.toContain("agenda");
  });
  it("financeiro aprende valores, cobranças, liminares e indicadores, mas não prontuário", () => {
    const r = ids(["financeiro"]);
    expect(r).toEqual(expect.arrayContaining(["financeiro-sessoes", "cobrancas", "liminares-glosas", "indicadores", "faltas", "guias"]));
    expect(r).not.toContain("prontuario");
  });
  it("administrador faz gestão, mas não o tópico de prontuário; master faz os dois", () => {
    expect(ids(["administrador"])).toContain("gestao-equipe");
    expect(ids(["administrador"])).not.toContain("prontuario");
    expect(ids(["master"])).toEqual(expect.arrayContaining(["gestao-equipe", "prontuario"]));
  });
  it("quem tem dois cargos soma as duas trilhas", () => {
    const r = ids(["recepcao", "financeiro"]);
    expect(r).toEqual(expect.arrayContaining(["agenda", "cobrancas"]));
  });
});

describe("questionário", () => {
  const m = moduloPorId("acesso-seguranca")!;
  it("aprova com 70% de acertos", () => {
    const certas = m.questoes.map((q) => q.correta);
    const quatroDeCinco = certas.map((c, i) => (i === 0 ? (c + 1) % 4 : c));
    expect(corrigir(m, quatroDeCinco).aprovado).toBe(true); // 80%
  });
  it("reprova abaixo de 70%", () => {
    const certas = m.questoes.map((q) => q.correta);
    const tresDeCinco = certas.map((c, i) => (i < 2 ? (c + 1) % 4 : c));
    expect(corrigir(m, tresDeCinco).aprovado).toBe(false); // 60%
  });
  it("todo tópico tem pelo menos 3 perguntas com gabarito válido", () => {
    for (const mod of MODULOS) {
      expect(mod.questoes.length).toBeGreaterThanOrEqual(3);
      for (const q of mod.questoes) expect(q.correta).toBeLessThan(q.opcoes.length);
    }
  });
});

describe("progresso", () => {
  const m = moduloPorId("lgpd-sigilo")!;
  it("aprovado na versão atual = concluído", () => {
    expect(situacaoDoTopico(m, [res("lgpd-sigilo", 5, 5)]).situacao).toBe("concluido");
  });
  it("reprovado = refazer; sem tentativa = pendente", () => {
    expect(situacaoDoTopico(m, [res("lgpd-sigilo", 2, 5)]).situacao).toBe("refazer");
    expect(situacaoDoTopico(m, []).situacao).toBe("pendente");
  });
  it("aprovação de versão antiga do conteúdo pede para refazer", () => {
    expect(situacaoDoTopico({ ...m, versao: 2 }, [res("lgpd-sigilo", 5, 5, 1)]).situacao).toBe("refazer");
  });
  it("conta o percentual da trilha", () => {
    const p = progressoDaTrilha(["profissional"], [res("acesso-seguranca", 5, 5), res("lgpd-sigilo", 5, 5)]);
    expect(p.concluidos).toBe(2);
    expect(p.obrigatorios).toBe(modulosDaTrilha(["profissional"]).length);
  });
});
