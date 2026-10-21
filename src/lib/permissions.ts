export type Papel = "master" | "recepcao" | "profissional" | "financeiro";

export const PAPEIS: { value: Papel; label: string; descricao: string }[] = [
  { value: "master", label: "Master", descricao: "Acesso total, inclusive a todos os prontuários" },
  { value: "recepcao", label: "Recepção", descricao: "Agenda e cadastro de pacientes" },
  { value: "profissional", label: "Profissional", descricao: "Prontuário apenas da(s) sua(s) especialidade(s)" },
  { value: "financeiro", label: "Financeiro", descricao: "Valores de tratamento e repasses" },
];

export function temPapel(papeis: readonly Papel[], ...alvo: Papel[]) {
  return alvo.some((a) => papeis.includes(a));
}

/** Master vê todos os prontuários; os demais apenas os das especialidades a que estão vinculados. */
export function podeVerProntuario(
  papeis: readonly Papel[],
  minhasEspecialidades: readonly string[],
  especialidadeId: string,
) {
  return papeis.includes("master") || minhasEspecialidades.includes(especialidadeId);
}

/** Só quem é da especialidade escreve evolução (o master só escreve se também for da especialidade). */
export function podeEscreverEvolucao(minhasEspecialidades: readonly string[], especialidadeId: string) {
  return minhasEspecialidades.includes(especialidadeId);
}

export const podeAgendar = (p: readonly Papel[]) => temPapel(p, "master", "recepcao");
export const podeEditarPaciente = (p: readonly Papel[]) => temPapel(p, "master", "recepcao");
export const podeGerirFinanceiro = (p: readonly Papel[]) => temPapel(p, "master", "financeiro");
export const podeGerirEquipe = (p: readonly Papel[]) => temPapel(p, "master");
