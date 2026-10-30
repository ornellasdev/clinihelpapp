export type Papel = "master" | "administrador" | "recepcao" | "profissional" | "financeiro";

export const PAPEIS: { value: Papel; label: string; descricao: string }[] = [
  { value: "master", label: "Master", descricao: "Acesso total, inclusive a todos os prontuários" },
  { value: "administrador", label: "Administrador", descricao: "Tudo do master, exceto ver prontuários" },
  { value: "recepcao", label: "Recepção", descricao: "Agenda e cadastro de pacientes" },
  { value: "profissional", label: "Profissional", descricao: "Prontuário apenas da(s) sua(s) especialidade(s)" },
  { value: "financeiro", label: "Financeiro", descricao: "Valores de tratamento e repasses" },
];

export function temPapel(papeis: readonly Papel[], ...alvo: Papel[]) {
  return alvo.some((a) => papeis.includes(a));
}

/** Master ou administrador: gestão completa da clínica. */
export const ehGestor = (p: readonly Papel[]) => temPapel(p, "master", "administrador");

/** Master vê todos os prontuários; os demais (inclusive administrador) apenas os das especialidades a que estão vinculados. */
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

export const podeAgendar = (p: readonly Papel[]) => ehGestor(p) || temPapel(p, "recepcao");
export const podeEditarPaciente = (p: readonly Papel[]) => ehGestor(p) || temPapel(p, "recepcao");
export const podeGerirFinanceiro = (p: readonly Papel[]) => ehGestor(p) || temPapel(p, "financeiro");
export const podeGerirEquipe = (p: readonly Papel[]) => ehGestor(p);

/** Só o master mexe em contas master; o administrador gere as demais e não vincula especialidades a si mesmo. */
export function podeAlterarMembro(meusPapeis: readonly Papel[], papeisDoMembro: readonly Papel[]) {
  if (meusPapeis.includes("master")) return true;
  return ehGestor(meusPapeis) && !papeisDoMembro.includes("master");
}
export function papeisAtribuiveis(meusPapeis: readonly Papel[]): Papel[] {
  return PAPEIS.map((p) => p.value).filter((v) => v !== "master" || meusPapeis.includes("master"));
}

/** Auditoria: master e administrador; os registros de prontuário só aparecem para o master. */
export const podeVerAuditoria = (p: readonly Papel[]) => ehGestor(p);
export const veAuditoriaDoProntuario = (p: readonly Papel[]) => p.includes("master");

/** Guias de convênio: recepção, gestão e financeiro veem e cadastram; liberação do dia é da recepção/gestão. */
export const podeVerGuias = (p: readonly Papel[]) => ehGestor(p) || temPapel(p, "recepcao", "financeiro");
export const podeLiberarSessao = (p: readonly Papel[]) => ehGestor(p) || temPapel(p, "recepcao");
export const podeRemoverGuia = (p: readonly Papel[]) => ehGestor(p) || temPapel(p, "recepcao");
/** Glosas envolvem valores: só gestão e financeiro. */
export const podeGerirGlosas = (p: readonly Papel[]) => ehGestor(p) || temPapel(p, "financeiro");
