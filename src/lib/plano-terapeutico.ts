// Regras do plano terapêutico: metas por especialidade, escala de progresso e modelos de evolução.

/** Escala de apoio usada em cada sessão (1 = não realizou … 5 = independente). */
export const NIVEIS = [
  { valor: 1, curto: "Não fez", label: "Não realizou" },
  { valor: 2, curto: "Ajuda total", label: "Com ajuda total" },
  { valor: 3, curto: "Ajuda parcial", label: "Com ajuda parcial" },
  { valor: 4, curto: "Pouca ajuda", label: "Com pouca ajuda" },
  { valor: 5, curto: "Independente", label: "Independente" },
] as const;

export const rotuloNivel = (n: number) => NIVEIS.find((x) => x.valor === n)?.label ?? "—";

export const STATUS_META = {
  ativa: "Em andamento",
  alcancada: "Alcançada",
  pausada: "Pausada",
} as const;
export type StatusMeta = keyof typeof STATUS_META;

export type RegistroProgresso = { meta_id: string; nivel: number; data: string };

/** Pontos do gráfico de uma meta, em ordem de data; vários registros no mesmo dia viram a média. */
export function serieDaMeta(metaId: string, registros: readonly RegistroProgresso[]) {
  const porDia = new Map<string, number[]>();
  for (const r of registros) {
    if (r.meta_id !== metaId) continue;
    porDia.set(r.data, [...(porDia.get(r.data) ?? []), r.nivel]);
  }
  return [...porDia.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([data, n]) => ({ data, nivel: Math.round((n.reduce((s, x) => s + x, 0) / n.length) * 10) / 10 }));
}

/** Resumo para pais e convênios: primeiro e último nível e quanto avançou. */
export function resumoDaMeta(metaId: string, registros: readonly RegistroProgresso[]) {
  const serie = serieDaMeta(metaId, registros);
  if (serie.length === 0) return { sessoes: 0, inicial: null, atual: null, avanco: 0 };
  const inicial = serie[0]!.nivel;
  const atual = serie[serie.length - 1]!.nivel;
  return { sessoes: serie.length, inicial, atual, avanco: Math.round((atual - inicial) * 10) / 10 };
}

/** Modelos prontos para quando a especialidade ainda não tem modelos próprios. */
export const MODELO_PADRAO = {
  nome: "Sessão (padrão)",
  conteudo: [
    "Objetivos trabalhados:",
    "",
    "Estratégias e recursos utilizados:",
    "",
    "Resposta da criança:",
    "",
    "Orientações à família:",
    "",
    "Próximos passos:",
    "",
  ].join("\n"),
};

/** Insere o modelo no texto: se o texto está vazio, substitui; senão, acrescenta ao fim. */
export function aplicarModelo(textoAtual: string, modelo: string) {
  return textoAtual.trim() ? `${textoAtual.trimEnd()}\n\n${modelo}` : modelo;
}

/** Evoluções dentro do período (datas AAAA-MM-DD, limites inclusivos), mais antigas primeiro — ordem do relatório. */
export function evolucoesDoPeriodo<T extends { data_atendimento: string; especialidade_id: string }>(
  evolucoes: readonly T[],
  de: string,
  ate: string,
  especialidades: readonly string[],
) {
  return evolucoes
    .filter((e) => e.data_atendimento >= de && e.data_atendimento <= ate && especialidades.includes(e.especialidade_id))
    .sort((a, b) => a.data_atendimento.localeCompare(b.data_atendimento));
}
