import { percentualRepasse, valorReais } from "./validacao";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { MSG_SENHA_FRACA, senhaForte } from "./senha";

const senhaTemporariaSchema = z.string().refine(senhaForte, MSG_SENHA_FRACA);

const papelSchema = z.enum(["master", "administrador", "recepcao", "profissional", "financeiro"]);

/** Master ou administrador podem gerir a equipe. Retorna se quem chama é master. */
async function exigirGestor(supabase: any, userId: string) {
  const [{ data: isMaster }, { data: isGestor }, { data: ctx }] = await Promise.all([
    supabase.rpc("has_role", { _user_id: userId, _role: "master" }),
    supabase.rpc("is_gestor", { _user_id: userId }),
    supabase.rpc("meu_contexto"),
  ]);
  if (!isMaster && !isGestor) throw new Error("Apenas o acesso master ou administrador pode fazer isso.");
  const clinicaId: string | undefined = ctx?.clinica?.id;
  if (!clinicaId) throw new Error("Clínica não identificada.");
  return { isMaster: !!isMaster, clinicaId, nome: ctx?.dev ? "Desenvolvedor CliniHelp" : undefined };
}

/** Só permite mexer em contas da mesma clínica de quem chama. */
async function exigirMesmaClinica(admin: any, clinicaId: string, alvoId: string) {
  const { data } = await admin.from("profiles").select("clinica_id").eq("id", alvoId).maybeSingle();
  if (!data || data.clinica_id !== clinicaId) throw new Error("Conta não encontrada nesta clínica.");
}

/** O administrador não pode alterar contas master (evita chegar aos prontuários por elas). */
async function bloquearAlvoMaster(supabase: any, isMaster: boolean, alvoId: string) {
  if (isMaster) return;
  const { data: alvoMaster } = await supabase.rpc("has_role", { _user_id: alvoId, _role: "master" });
  if (alvoMaster) throw new Error("Apenas o acesso master pode alterar uma conta master.");
}

const membroSchema = z.object({
  nome: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(255),
  password: senhaTemporariaSchema,
  telefone: z.string().trim().max(30).optional().default(""),
  conselho: z.string().trim().max(20).optional().default(""),
  registro: z.string().trim().max(40).optional().default(""),
  papeis: z.array(papelSchema).min(1),
  especialidades: z.array(z.string().uuid()).default([]),
  valorPadrao: valorReais("Valor padrão da sessão").default(0),
  percentualPadrao: percentualRepasse("Repasse de profissional").default(50),
});

export const criarMembro = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.input<typeof membroSchema>) => membroSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { isMaster, clinicaId, nome: nomeAutor } = await exigirGestor(context.supabase, context.userId);
    if (!isMaster && data.papeis.includes("master")) {
      throw new Error("Apenas o acesso master pode criar outra conta master.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { nome: data.nome, clinica_id: clinicaId },
    });
    if (error || !created.user) throw new Error(error?.message ?? "Não foi possível criar o usuário.");
    const id = created.user.id;

    await supabaseAdmin.from("profiles").upsert({
      id,
      clinica_id: clinicaId,
      nome: data.nome,
      email: data.email,
      telefone: data.telefone || null,
      conselho: data.conselho || null,
      registro_profissional: data.registro || null,
      senha_temporaria: true,
    });
    await supabaseAdmin.from("user_roles").insert(data.papeis.map((role) => ({ user_id: id, role, clinica_id: clinicaId })));
    if (data.especialidades.length) {
      await supabaseAdmin
        .from("profissional_especialidades")
        .insert(data.especialidades.map((especialidade_id) => ({ user_id: id, especialidade_id, clinica_id: clinicaId })));
    }
    await supabaseAdmin.from("profissional_config").upsert({
      user_id: id,
      clinica_id: clinicaId,
      valor_sessao_padrao: data.valorPadrao,
      percentual_repasse_padrao: data.percentualPadrao,
    });
    const { registrarAuditoria } = await import("./auditoria.server");
    await registrarAuditoria(supabaseAdmin, {
      clinicaId,
      usuarioNome: nomeAutor,
      usuarioId: context.userId,
      acao: "criou",
      registroId: id,
      descricao: `${data.nome} · ${data.email}`,
      depois: { nome: data.nome, email: data.email, papeis: data.papeis, percentual_repasse_padrao: data.percentualPadrao },
    });
    return { id };
  });

export const definirAtivo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string; ativo: boolean }) =>
    z.object({ userId: z.string().uuid(), ativo: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { isMaster, clinicaId, nome: nomeAutor } = await exigirGestor(context.supabase, context.userId);
    await bloquearAlvoMaster(context.supabase, isMaster, data.userId);
    if (data.userId === context.userId && !data.ativo) throw new Error("Você não pode desativar a própria conta.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await exigirMesmaClinica(supabaseAdmin, clinicaId, data.userId);
    await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      ban_duration: data.ativo ? "none" : "876000h",
    });
    await supabaseAdmin.from("profiles").update({ ativo: data.ativo }).eq("id", data.userId);
    const { registrarAuditoria } = await import("./auditoria.server");
    const { data: alvo } = await supabaseAdmin.from("profiles").select("nome, email").eq("id", data.userId).maybeSingle();
    await registrarAuditoria(supabaseAdmin, {
      clinicaId,
      usuarioNome: nomeAutor,
      usuarioId: context.userId,
      acao: data.ativo ? "reativou" : "desativou",
      registroId: data.userId,
      descricao: [alvo?.nome, alvo?.email].filter(Boolean).join(" · "),
    });
    return { ok: true };
  });

export const redefinirSenha = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string; password: string }) =>
    z.object({ userId: z.string().uuid(), password: senhaTemporariaSchema }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { isMaster, clinicaId, nome: nomeAutor } = await exigirGestor(context.supabase, context.userId);
    await bloquearAlvoMaster(context.supabase, isMaster, data.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await exigirMesmaClinica(supabaseAdmin, clinicaId, data.userId);
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, { password: data.password });
    if (error) throw new Error(error.message);
    // Senha temporária: no próximo login a pessoa precisa criar a própria senha.
    await supabaseAdmin.from("profiles").update({ senha_temporaria: true }).eq("id", data.userId);
    const { registrarAuditoria } = await import("./auditoria.server");
    const { data: alvo } = await supabaseAdmin.from("profiles").select("nome, email").eq("id", data.userId).maybeSingle();
    await registrarAuditoria(supabaseAdmin, {
      clinicaId,
      usuarioNome: nomeAutor,
      usuarioId: context.userId,
      acao: "redefiniu_senha",
      registroId: data.userId,
      descricao: [alvo?.nome, alvo?.email].filter(Boolean).join(" · "),
    });
    return { ok: true };
  });

/** Apaga o autenticador cadastrado (celular perdido/trocado). No próximo login a pessoa cadastra outro. */
export const redefinirDuasEtapas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string }) => z.object({ userId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { isMaster, clinicaId, nome: nomeAutor } = await exigirGestor(context.supabase, context.userId);
    await bloquearAlvoMaster(context.supabase, isMaster, data.userId);
    if (data.userId === context.userId) throw new Error("Você não pode apagar a verificação em duas etapas da própria conta.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await exigirMesmaClinica(supabaseAdmin, clinicaId, data.userId);
    const { data: lista, error } = await supabaseAdmin.auth.admin.mfa.listFactors({ userId: data.userId });
    if (error) throw new Error(error.message);
    for (const f of lista?.factors ?? []) {
      const r = await supabaseAdmin.auth.admin.mfa.deleteFactor({ userId: data.userId, id: f.id });
      if (r.error) throw new Error(r.error.message);
    }
    const { registrarAuditoria } = await import("./auditoria.server");
    const { data: alvo } = await supabaseAdmin.from("profiles").select("nome, email").eq("id", data.userId).maybeSingle();
    await registrarAuditoria(supabaseAdmin, {
      clinicaId,
      usuarioNome: nomeAutor,
      usuarioId: context.userId,
      acao: "redefiniu_2fa",
      registroId: data.userId,
      descricao: [alvo?.nome, alvo?.email].filter(Boolean).join(" · "),
    });
    return { ok: true };
  });
