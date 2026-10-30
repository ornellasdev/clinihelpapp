import { describe, expect, it } from "vitest";
import { avaliarControles, resumoConformidade, type PainelGovernanca } from "./conformidade";

const base = (): PainelGovernanca => ({
  lgpd: { ativos: 10, assinado: 10, pendente: 0, revogado: 0, clinicos_no_cadastro: 0, pendentes_lista: [] },
  equipe: { ativos: 3, sem_2fa: 0, senha_temporaria: 0, inativos: 0, contas: [] },
  auditoria: { eventos_30d: 50, logins_30d: 20, saidas_inatividade_30d: 2, exclusoes_30d: 1, ultimo_registro: null },
  banco: {
    tabelas_sem_rls: [],
    views_sem_invoker: [],
    buckets_publicos: [],
    funcoes_anonimas: 0,
    auditoria_imutavel: true,
    evolucao_imutavel: true,
    evolucao_sem_exclusao: true,
    adendo_imutavel: true,
    tabelas_auditadas: 29,
  },
  integridade: { finalizadas_sem_evolucao: 0, faltas_justificadas_sem_atestado: 0, excluidos: { guias: 0, glosas: 0, documentos: 0, relatorios: 0 }, adendos: 0 },
  treinamento: { ativos: 3, concluiram: 3 },
  gerado_em: "2026-10-30T12:00:00Z",
});
const situacao = (p: PainelGovernanca, id: string) => avaliarControles(p).find((c) => c.id === id)!.situacao;

describe("controles de conformidade", () => {
  it("tudo protegido = 100% em ordem", () => {
    const r = resumoConformidade(avaliarControles(base()));
    expect(r.critico).toBe(0);
    expect(r.atencao).toBe(0);
    expect(r.percentual).toBe(100);
  });

  it("paciente ativo sem termo LGPD pede atenção", () => {
    const p = base();
    p.lgpd.pendente = 2;
    expect(situacao(p, "lgpd-consentimento")).toBe("atencao");
  });

  it("consentimento revogado é crítico", () => {
    const p = base();
    p.lgpd.revogado = 1;
    expect(situacao(p, "lgpd-consentimento")).toBe("critico");
  });

  it("tabela sem regra de acesso é crítica", () => {
    const p = base();
    p.banco.tabelas_sem_rls = ["nova_tabela"];
    expect(situacao(p, "iso-acesso")).toBe("critico");
  });

  it("local de arquivos público é crítico", () => {
    const p = base();
    p.banco.buckets_publicos = ["documentos-pacientes"];
    expect(situacao(p, "lgpd-arquivos")).toBe("critico");
  });

  it("função do banco aberta a visitantes é crítica", () => {
    const p = base();
    p.banco.funcoes_anonimas = 1;
    expect(situacao(p, "soc2-acesso")).toBe("critico");
  });

  it("pessoa sem verificação em 2 etapas pede atenção", () => {
    const p = base();
    p.equipe.sem_2fa = 1;
    expect(situacao(p, "iso-2fa")).toBe("atencao");
  });

  it("equipe sem o treinamento essencial pede atenção", () => {
    const p = base();
    p.treinamento.concluiram = 1;
    expect(situacao(p, "iso-treinamento")).toBe("atencao");
  });

  it("prontuário que pode ser alterado é crítico", () => {
    const p = base();
    p.banco.evolucao_imutavel = false;
    expect(situacao(p, "hipaa-integridade")).toBe("critico");
  });
});
