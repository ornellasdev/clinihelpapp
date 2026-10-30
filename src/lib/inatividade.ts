// Saída automática por inatividade (HIPAA "automatic logoff"): regras puras, testadas em inatividade.test.ts.

/** Tempo sem uso até a sessão ser encerrada. */
export const LIMITE_INATIVIDADE_MS = 15 * 60_000;
/** Quanto antes do fim aparece o aviso "Você ainda está aí?". */
export const AVISO_ANTES_MS = 60_000;
/** Chave compartilhada entre abas: uso em qualquer aba conta como atividade. */
export const CHAVE_ULTIMA_ATIVIDADE = "clinihelp:ultima-atividade";

export type SituacaoInatividade = "ativo" | "aviso" | "expirado";

export function situacaoInatividade(ultimaAtividade: number, agora: number): SituacaoInatividade {
  const parado = agora - ultimaAtividade;
  if (parado >= LIMITE_INATIVIDADE_MS) return "expirado";
  if (parado >= LIMITE_INATIVIDADE_MS - AVISO_ANTES_MS) return "aviso";
  return "ativo";
}

export function segundosParaSair(ultimaAtividade: number, agora: number): number {
  return Math.max(0, Math.ceil((LIMITE_INATIVIDADE_MS - (agora - ultimaAtividade)) / 1000));
}
