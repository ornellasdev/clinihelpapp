// Etapa de avaliação inicial do paciente novo: pagamento → formulário da família → pode agendar.
// O banco é quem bloqueia o agendamento (trigger exigir_avaliacao_inicial); aqui ficam os espelhos para a tela.
import type { StatusCobranca } from "./cobrancas";

export type StatusAvaliacao = "aguardando_pagamento" | "aguardando_formulario" | "concluida" | "dispensada";

export const STATUS_AVALIACAO: Record<StatusAvaliacao, { label: string; descricao: string; className: string }> = {
  aguardando_pagamento: {
    label: "Aguardando pagamento",
    descricao: "A primeira consulta só pode ser agendada depois do pagamento da avaliação e do formulário preenchido.",
    className: "bg-warning/25 text-warning-foreground",
  },
  aguardando_formulario: {
    label: "Aguardando formulário",
    descricao: "Pagamento confirmado. O formulário está na Área da família, esperando os responsáveis preencherem.",
    className: "bg-secondary text-secondary-foreground",
  },
  concluida: {
    label: "Pronto para agendar",
    descricao: "Pagamento confirmado e formulário preenchido. A primeira consulta já pode ser agendada.",
    className: "bg-success/15 text-success",
  },
  dispensada: { label: "Sem avaliação", descricao: "", className: "bg-muted text-muted-foreground" },
};

/** Mesma regra do trigger no banco: com pagamento ou formulário pendente, nada é agendado. */
export const bloqueiaAgendamento = (s: StatusAvaliacao | null | undefined) => s === "aguardando_pagamento" || s === "aguardando_formulario";

/** Cobrança da avaliação que ainda "vale": enquanto existir, não se gera outra. */
export const COBRANCA_AVALIACAO_EM_ABERTO: StatusCobranca[] = ["pendente", "em_analise", "pago", "contestado"];

/** Motivo para não gerar a cobrança da avaliação (ou null se pode). */
export function motivoSemCobrancaAvaliacao(status: StatusAvaliacao | null | undefined, cobrancaAtual: StatusCobranca | null | undefined): string | null {
  if (!status || status === "dispensada") return "Este paciente não tem avaliação inicial pendente.";
  if (status !== "aguardando_pagamento") return "O pagamento da avaliação já foi confirmado.";
  if (cobrancaAtual && COBRANCA_AVALIACAO_EM_ABERTO.includes(cobrancaAtual)) return "Já existe uma cobrança da avaliação em aberto. Cancele-a antes de gerar outra.";
  return null;
}

/** Passo atual da linha do tempo (0 pagamento, 1 formulário, 2 concluído). */
export function etapaAvaliacao(s: StatusAvaliacao): 0 | 1 | 2 {
  return s === "aguardando_pagamento" ? 0 : s === "aguardando_formulario" ? 1 : 2;
}

export const ETAPAS_AVALIACAO = ["Pagamento da avaliação", "Formulário da família", "Agendar 1ª consulta"] as const;

/** Texto da descrição da cobrança que o responsável vê. */
export const descricaoCobrancaAvaliacao = (paciente: string) => `Avaliação inicial — ${paciente}`;

/** Endereço da Área da família (onde o formulário fica disponível). */
export const URL_AREA_FAMILIA = "https://clinihelpsystem.lovable.app/familia";

/** Mensagem pronta (WhatsApp) avisando que o formulário está disponível, com link e instruções de acesso. */
export function mensagemFormularioDisponivel(p: { responsavel?: string | null; crianca: string; clinica: string; email?: string | null }): string {
  const primeiro = (p.responsavel ?? "").trim().split(/\s+/)[0];
  return [
    `Olá${primeiro ? `, ${primeiro}` : ""}! Aqui é da ${p.clinica}.`,
    `Recebemos o pagamento da avaliação de ${p.crianca}. Agora falta só o formulário de entrevista inicial.`,
    `1. Acesse ${URL_AREA_FAMILIA}`,
    `2. Digite ${p.email ? `o e-mail ${p.email}` : "o e-mail cadastrado na ficha da criança"} e o código que chegar por e-mail.`,
    "3. Toque em “Preencher formulário de avaliação” e responda todas as perguntas com o máximo de detalhes.",
    "Assim que o formulário for enviado, entramos em contato para agendar a primeira consulta.",
  ].join("\n");
}
