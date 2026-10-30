// Regras do treinamento: trilha por cargo, correção do questionário e progresso. Testadas em trilha.test.ts.
import type { Papel } from "@/lib/permissions";
import { MODULOS, type Modulo } from "./conteudo";

/** Nota mínima para aprovação no questionário de cada tópico. */
export const NOTA_MINIMA = 0.7;

export type ResultadoTreinamento = {
  user_id: string;
  modulo_id: string;
  versao: number;
  acertos: number;
  total: number;
  aprovado: boolean;
  created_at: string;
};

/** Tópicos obrigatórios para quem tem esses papéis (desenvolvedor vê tudo). */
export function modulosDaTrilha(papeis: readonly Papel[], todos = false): Modulo[] {
  if (todos) return MODULOS;
  return MODULOS.filter((m) => m.papeis.some((p) => papeis.includes(p)));
}

export type Correcao = { acertos: number; total: number; aprovado: boolean; gabarito: { correta: number; acertou: boolean }[] };

export function corrigir(modulo: Modulo, respostas: readonly number[]): Correcao {
  const gabarito = modulo.questoes.map((q, i) => ({ correta: q.correta, acertou: respostas[i] === q.correta }));
  const acertos = gabarito.filter((g) => g.acertou).length;
  const total = modulo.questoes.length;
  return { acertos, total, aprovado: total > 0 && acertos / total >= NOTA_MINIMA, gabarito };
}

export type SituacaoTopico = { situacao: "concluido" | "refazer" | "pendente"; melhor: ResultadoTreinamento | null; tentativas: number };

/** Concluído = aprovado na versão atual do tópico. Aprovação de versão antiga pede para refazer. */
export function situacaoDoTopico(modulo: Modulo, resultados: readonly ResultadoTreinamento[]): SituacaoTopico {
  const meus = resultados.filter((r) => r.modulo_id === modulo.id);
  const atuais = meus.filter((r) => r.versao === modulo.versao);
  const melhor = [...atuais].sort((a, b) => b.acertos / b.total - a.acertos / a.total)[0] ?? null;
  if (atuais.some((r) => r.aprovado)) return { situacao: "concluido", melhor, tentativas: meus.length };
  return { situacao: meus.length ? "refazer" : "pendente", melhor, tentativas: meus.length };
}

export function progressoDaTrilha(papeis: readonly Papel[], resultados: readonly ResultadoTreinamento[], todos = false) {
  const trilha = modulosDaTrilha(papeis, todos);
  const concluidos = trilha.filter((m) => situacaoDoTopico(m, resultados).situacao === "concluido").length;
  return { obrigatorios: trilha.length, concluidos, percentual: trilha.length ? Math.round((concluidos / trilha.length) * 100) : 0 };
}
