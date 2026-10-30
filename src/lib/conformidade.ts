// Avaliação dos controles de conformidade (LGPD, ISO 27001, HIPAA, SOC 2) a partir do painel_governanca do banco.
// Regras puras, testadas em conformidade.test.ts.
import { LIMITE_INATIVIDADE_MS } from "./inatividade";

export type PainelGovernanca = {
  lgpd: {
    ativos: number;
    assinado: number;
    pendente: number;
    revogado: number;
    clinicos_no_cadastro: number;
    pendentes_lista: { id: string; nome: string; status: string; desde: string }[];
  };
  equipe: {
    ativos: number;
    sem_2fa: number;
    senha_temporaria: number;
    inativos: number;
    contas: {
      id: string;
      nome: string;
      papeis: string[];
      ativo: boolean;
      senha_temporaria: boolean;
      tem_2fa: boolean;
      ultimo_acesso: string | null;
    }[];
  };
  auditoria: {
    eventos_30d: number;
    logins_30d: number;
    saidas_inatividade_30d: number;
    exclusoes_30d: number;
    ultimo_registro: string | null;
  };
  banco: {
    tabelas_sem_rls: string[];
    views_sem_invoker: string[];
    buckets_publicos: string[];
    funcoes_anonimas: number;
    auditoria_imutavel: boolean;
    evolucao_imutavel: boolean;
    evolucao_sem_exclusao: boolean;
    adendo_imutavel: boolean;
    tabelas_auditadas: number;
  };
  integridade: {
    finalizadas_sem_evolucao: number;
    faltas_justificadas_sem_atestado: number;
    excluidos: { guias: number; glosas: number; documentos: number; relatorios: number };
    adendos: number;
  };
  /** Pessoas ativas da equipe e quantas concluíram os tópicos essenciais do treinamento. */
  treinamento: { ativos: number; concluiram: number };
  gerado_em: string;
};

export type Situacao = "ok" | "atencao" | "critico";
export type Norma = "LGPD" | "ISO 27001" | "HIPAA" | "SOC 2";
export type Controle = { id: string; norma: Norma; referencia: string; titulo: string; situacao: Situacao; detalhe: string };

export const NORMAS: { norma: Norma; descricao: string }[] = [
  { norma: "LGPD", descricao: "Dados de saúde e de crianças (Art. 11 e 14)" },
  { norma: "ISO 27001", descricao: "Controle de acesso e registro de eventos" },
  { norma: "HIPAA", descricao: "Salvaguardas técnicas de dados de saúde" },
  { norma: "SOC 2", descricao: "Acesso lógico e monitoramento" },
];

const pl = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

export function avaliarControles(p: PainelGovernanca): Controle[] {
  const { lgpd, equipe, banco, auditoria, integridade } = p;
  const minutos = Math.round(LIMITE_INATIVIDADE_MS / 60_000);
  const pendenciasOperacionais = integridade.finalizadas_sem_evolucao + integridade.faltas_justificadas_sem_atestado;

  return [
    {
      id: "lgpd-consentimento",
      norma: "LGPD",
      referencia: "Art. 11 e 14",
      titulo: "Consentimento dos responsáveis",
      situacao: lgpd.revogado > 0 ? "critico" : lgpd.pendente > 0 ? "atencao" : "ok",
      detalhe:
        lgpd.ativos === 0
          ? "Nenhum paciente ativo."
          : lgpd.revogado > 0
            ? `${pl(lgpd.revogado, "paciente teve", "pacientes tiveram")} o consentimento revogado.`
            : lgpd.pendente > 0
              ? `${lgpd.pendente} de ${lgpd.ativos} pacientes ativos ainda sem termo assinado.`
              : `Todos os ${lgpd.ativos} pacientes ativos têm termo assinado.`,
    },
    {
      id: "lgpd-minimizacao",
      norma: "LGPD",
      referencia: "Art. 6º, III",
      titulo: "Dados clínicos separados do cadastro",
      situacao: lgpd.clinicos_no_cadastro === 0 ? "ok" : "critico",
      detalhe:
        lgpd.clinicos_no_cadastro === 0
          ? "Diagnóstico, CID, alergias e medicação só ficam com a equipe terapêutica."
          : `${pl(lgpd.clinicos_no_cadastro, "cadastro ainda tem", "cadastros ainda têm")} dados clínicos visíveis à recepção.`,
    },
    {
      id: "lgpd-arquivos",
      norma: "LGPD",
      referencia: "Art. 46",
      titulo: "Arquivos privados com link temporário",
      situacao: banco.buckets_publicos.length === 0 ? "ok" : "critico",
      detalhe:
        banco.buckets_publicos.length === 0
          ? "Atestados, guias, documentos e relatórios só abrem por link de até 5 minutos."
          : `Locais de arquivos públicos: ${banco.buckets_publicos.join(", ")}.`,
    },
    {
      id: "iso-acesso",
      norma: "ISO 27001",
      referencia: "A.9.4.1",
      titulo: "Restrição de acesso por perfil no banco",
      situacao: banco.tabelas_sem_rls.length === 0 && banco.views_sem_invoker.length === 0 ? "ok" : "critico",
      detalhe:
        banco.tabelas_sem_rls.length === 0 && banco.views_sem_invoker.length === 0
          ? "Todas as tabelas e consultas aplicam as regras de acesso de quem consulta."
          : `Sem regra de acesso: ${[...banco.tabelas_sem_rls, ...banco.views_sem_invoker].join(", ")}.`,
    },
    {
      id: "iso-2fa",
      norma: "ISO 27001",
      referencia: "A.9.4.2",
      titulo: "Verificação em 2 etapas da equipe",
      situacao: equipe.sem_2fa === 0 ? "ok" : "atencao",
      detalhe:
        equipe.sem_2fa === 0
          ? `Todas as ${equipe.ativos} contas ativas usam o Google Authenticator.`
          : `${pl(equipe.sem_2fa, "pessoa ainda não cadastrou", "pessoas ainda não cadastraram")} o autenticador (ficam sem acesso aos dados até cadastrar).`,
    },
    {
      id: "iso-senha",
      norma: "ISO 27001",
      referencia: "A.9.2.4",
      titulo: "Senha própria (sem senha temporária)",
      situacao: equipe.senha_temporaria === 0 ? "ok" : "atencao",
      detalhe:
        equipe.senha_temporaria === 0
          ? "Ninguém está usando senha criada pela gestão."
          : `${pl(equipe.senha_temporaria, "conta ainda usa", "contas ainda usam")} senha temporária.`,
    },
    {
      id: "iso-treinamento",
      norma: "ISO 27001",
      referencia: "A.7.2.2",
      titulo: "Treinamento de segurança e LGPD da equipe",
      situacao: p.treinamento.concluiram >= p.treinamento.ativos ? "ok" : "atencao",
      detalhe:
        p.treinamento.ativos === 0
          ? "Nenhuma pessoa ativa na equipe."
          : `${p.treinamento.concluiram} de ${p.treinamento.ativos} pessoas concluíram os tópicos essenciais do Treinamento.`,
    },
    {
      id: "iso-registro",
      norma: "ISO 27001",
      referencia: "A.12.4",
      titulo: "Registro de eventos imutável",
      situacao: banco.auditoria_imutavel ? "ok" : "critico",
      detalhe: banco.auditoria_imutavel
        ? "A trilha de auditoria não pode ser alterada nem apagada, nem pelo servidor."
        : "A proteção da trilha de auditoria está desligada.",
    },
    {
      id: "hipaa-logoff",
      norma: "HIPAA",
      referencia: "§164.312(a)(2)(iii)",
      titulo: "Saída automática por inatividade",
      situacao: minutos <= 15 ? "ok" : "atencao",
      detalhe: `Sessão encerrada após ${minutos} min sem uso · ${pl(auditoria.saidas_inatividade_30d, "saída automática", "saídas automáticas")} em 30 dias.`,
    },
    {
      id: "hipaa-auditoria",
      norma: "HIPAA",
      referencia: "§164.312(b)",
      titulo: "Controles de auditoria",
      situacao: banco.auditoria_imutavel && banco.tabelas_auditadas > 0 ? "ok" : "critico",
      detalhe: `${banco.tabelas_auditadas} áreas registram cada criação, alteração e exclusão · ${auditoria.eventos_30d} eventos em 30 dias.`,
    },
    {
      id: "hipaa-integridade",
      norma: "HIPAA",
      referencia: "§164.312(c)(1)",
      titulo: "Integridade do prontuário",
      situacao: banco.evolucao_imutavel && banco.evolucao_sem_exclusao && banco.adendo_imutavel ? "ok" : "critico",
      detalhe:
        banco.evolucao_imutavel && banco.evolucao_sem_exclusao && banco.adendo_imutavel
          ? `Evoluções assinadas não mudam; correções por adendo (${integridade.adendos} registrados).`
          : "Alguma proteção do prontuário está desligada.",
    },
    {
      id: "soc2-acesso",
      norma: "SOC 2",
      referencia: "CC6.1",
      titulo: "Nada do banco acessível sem login",
      situacao: banco.funcoes_anonimas === 0 ? "ok" : "critico",
      detalhe:
        banco.funcoes_anonimas === 0
          ? "Nenhuma função do banco pode ser chamada por visitantes."
          : `${pl(banco.funcoes_anonimas, "função pode", "funções podem")} ser chamadas sem login.`,
    },
    {
      id: "soc2-monitoramento",
      norma: "SOC 2",
      referencia: "CC7.2",
      titulo: "Pendências de registro clínico",
      situacao: pendenciasOperacionais === 0 ? "ok" : "atencao",
      detalhe:
        pendenciasOperacionais === 0
          ? "Toda sessão finalizada tem evolução e toda falta justificada tem atestado."
          : [
              integridade.finalizadas_sem_evolucao && pl(integridade.finalizadas_sem_evolucao, "sessão finalizada sem evolução", "sessões finalizadas sem evolução"),
              integridade.faltas_justificadas_sem_atestado &&
                pl(integridade.faltas_justificadas_sem_atestado, "falta justificada sem atestado", "faltas justificadas sem atestado"),
            ]
              .filter(Boolean)
              .join(" · ") + ".",
    },
  ];
}

export function resumoConformidade(controles: readonly Controle[]) {
  const ok = controles.filter((c) => c.situacao === "ok").length;
  const atencao = controles.filter((c) => c.situacao === "atencao").length;
  const critico = controles.filter((c) => c.situacao === "critico").length;
  return { ok, atencao, critico, total: controles.length, percentual: controles.length ? Math.round((ok / controles.length) * 100) : 0 };
}
