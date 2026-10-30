/** Registra na auditoria ações feitas pelo servidor (contas da equipe, avisos de pagamento), que os gatilhos do banco não identificam. */
export async function registrarAuditoria(
  admin: any,
  r: {
    clinicaId: string;
    usuarioId?: string | null;
    usuarioNome?: string | undefined;
    acao: string;
    registroId: string;
    descricao: string;
    tabela?: string;
    antes?: Record<string, unknown> | null;
    depois?: Record<string, unknown>;
    campos?: string[];
  },
) {
  let nome = r.usuarioNome ?? null;
  if (!nome && r.usuarioId) {
    const { data: perfil } = await admin.from("profiles").select("nome").eq("id", r.usuarioId).maybeSingle();
    nome = perfil?.nome ?? null;
  }
  const { error } = await admin.from("auditoria").insert({
    clinica_id: r.clinicaId,
    usuario_id: r.usuarioId ?? null,
    usuario_nome: nome,
    acao: r.acao,
    tabela: r.tabela ?? "contas",
    registro_id: r.registroId,
    descricao: r.descricao,
    campos: r.campos ?? null,
    antes: r.antes ?? null,
    depois: r.depois ?? null,
  });
  if (error) console.error("Falha ao registrar auditoria:", error.message);
}
