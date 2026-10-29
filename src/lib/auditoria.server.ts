/** Registra na auditoria ações feitas pelo servidor (contas da equipe), que os gatilhos do banco não identificam. */
export async function registrarAuditoria(
  admin: any,
  r: { clinicaId: string; usuarioId: string; usuarioNome?: string | undefined; acao: string; registroId: string; descricao: string; depois?: Record<string, unknown> },
) {
  const { data: perfil } = await admin.from("profiles").select("nome").eq("id", r.usuarioId).maybeSingle();
  const { error } = await admin.from("auditoria").insert({
    clinica_id: r.clinicaId,
    usuario_id: r.usuarioId,
    usuario_nome: r.usuarioNome ?? perfil?.nome ?? null,
    acao: r.acao,
    tabela: "contas",
    registro_id: r.registroId,
    descricao: r.descricao,
    depois: r.depois ?? null,
  });
  if (error) console.error("Falha ao registrar auditoria:", error.message);
}
