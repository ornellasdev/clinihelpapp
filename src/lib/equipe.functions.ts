import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const papelSchema = z.enum(["master", "administrador", "recepcao", "profissional", "financeiro"]);

const masterSchema = z.object({
  nome: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(72),
});

/** Cria a primeira conta master. Só funciona enquanto não existir nenhum master. */
export const criarMasterInicial = createServerFn({ method: "POST" })
  .inputValidator((input: z.infer<typeof masterSchema>) => masterSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count } = await supabaseAdmin
      .from("user_roles")
      .select("id", { count: "exact", head: true })
      .eq("role", "master");
    if ((count ?? 0) > 0) throw new Error("A conta master já foi criada.");

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { nome: data.nome },
    });
    if (error || !created.user) throw new Error(error?.message ?? "Não foi possível criar a conta.");
    await supabaseAdmin.from("profiles").upsert({ id: created.user.id, nome: data.nome, email: data.email });
    const { error: roleErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: created.user.id, role: "master" });
    if (roleErr) throw new Error(roleErr.message);
    const { registrarAuditoria } = await import("./auditoria.server");
    await registrarAuditoria(supabaseAdmin, {
      usuarioId: created.user.id,
      acao: "criou",
      registroId: created.user.id,
      descricao: `Conta master inicial · ${data.nome}`,
      depois: { nome: data.nome, email: data.email, papeis: ["master"] },
    });
    return { ok: true };
  });

/** Master ou administrador podem gerir a equipe. Retorna se quem chama é master. */
async function exigirGestor(supabase: any, userId: string) {
  const [{ data: isMaster }, { data: isGestor }] = await Promise.all([
    supabase.rpc("has_role", { _user_id: userId, _role: "master" }),
    supabase.rpc("is_gestor", { _user_id: userId }),
  ]);
  if (!isMaster && !isGestor) throw new Error("Apenas o acesso master ou administrador pode fazer isso.");
  return { isMaster: !!isMaster };
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
  password: z.string().min(8).max(72),
  telefone: z.string().trim().max(30).optional().default(""),
  conselho: z.string().trim().max(20).optional().default(""),
  registro: z.string().trim().max(40).optional().default(""),
  papeis: z.array(papelSchema).min(1),
  especialidades: z.array(z.string().uuid()).default([]),
  valorPadrao: z.number().min(0).default(0),
  percentualPadrao: z.number().min(0).max(100).default(50),
});

export const criarMembro = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.input<typeof membroSchema>) => membroSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { isMaster } = await exigirGestor(context.supabase, context.userId);
    if (!isMaster && data.papeis.includes("master")) {
      throw new Error("Apenas o acesso master pode criar outra conta master.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { nome: data.nome },
    });
    if (error || !created.user) throw new Error(error?.message ?? "Não foi possível criar o usuário.");
    const id = created.user.id;

    await supabaseAdmin.from("profiles").upsert({
      id,
      nome: data.nome,
      email: data.email,
      telefone: data.telefone || null,
      conselho: data.conselho || null,
      registro_profissional: data.registro || null,
    });
    await supabaseAdmin.from("user_roles").insert(data.papeis.map((role) => ({ user_id: id, role })));
    if (data.especialidades.length) {
      await supabaseAdmin
        .from("profissional_especialidades")
        .insert(data.especialidades.map((especialidade_id) => ({ user_id: id, especialidade_id })));
    }
    await supabaseAdmin.from("profissional_config").upsert({
      user_id: id,
      valor_sessao_padrao: data.valorPadrao,
      percentual_repasse_padrao: data.percentualPadrao,
    });
    const { registrarAuditoria } = await import("./auditoria.server");
    await registrarAuditoria(supabaseAdmin, {
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
    const { isMaster } = await exigirGestor(context.supabase, context.userId);
    await bloquearAlvoMaster(context.supabase, isMaster, data.userId);
    if (data.userId === context.userId && !data.ativo) throw new Error("Você não pode desativar a própria conta.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      ban_duration: data.ativo ? "none" : "876000h",
    });
    await supabaseAdmin.from("profiles").update({ ativo: data.ativo }).eq("id", data.userId);
    const { registrarAuditoria } = await import("./auditoria.server");
    const { data: alvo } = await supabaseAdmin.from("profiles").select("nome, email").eq("id", data.userId).maybeSingle();
    await registrarAuditoria(supabaseAdmin, {
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
    z.object({ userId: z.string().uuid(), password: z.string().min(8).max(72) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { isMaster } = await exigirGestor(context.supabase, context.userId);
    await bloquearAlvoMaster(context.supabase, isMaster, data.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, { password: data.password });
    if (error) throw new Error(error.message);
    const { registrarAuditoria } = await import("./auditoria.server");
    const { data: alvo } = await supabaseAdmin.from("profiles").select("nome, email").eq("id", data.userId).maybeSingle();
    await registrarAuditoria(supabaseAdmin, {
      usuarioId: context.userId,
      acao: "redefiniu_senha",
      registroId: data.userId,
      descricao: [alvo?.nome, alvo?.email].filter(Boolean).join(" · "),
    });
    return { ok: true };
  });
