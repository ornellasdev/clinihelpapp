import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { MSG_SENHA_FRACA, senhaForte } from "./senha";

/** Testa a senha num cliente descartável: se o login funcionar, ela é igual à atual (temporária). */
async function igualSenhaAtual(email: string, senha: string): Promise<boolean> {
  const url = process.env["SUPABASE_URL"]!;
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  const teste = createClient(url, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
  const { data, error } = await teste.auth.signInWithPassword({ email, password: senha });
  if (error || !data.session) return false;
  await teste.auth.signOut({ scope: "local" });
  return true;
}

/**
 * Primeiro login (ou depois de uma redefinição): a pessoa troca a senha temporária pela própria.
 * Se ela já tem o autenticador cadastrado, precisa ter confirmado o código nesta sessão.
 */
export const definirMinhaSenha = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { senha: string }) => z.object({ senha: z.string().refine(senhaForte, MSG_SENHA_FRACA) }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: perfil } = await supabaseAdmin
      .from("profiles")
      .select("email, nome, clinica_id, senha_temporaria")
      .eq("id", context.userId)
      .maybeSingle();
    if (!perfil?.clinica_id) throw new Error("Conta não encontrada.");
    if (!perfil.senha_temporaria) throw new Error("Sua senha já foi definida.");

    const { data: fatores } = await supabaseAdmin.auth.admin.mfa.listFactors({ userId: context.userId });
    const temAutenticador = (fatores?.factors ?? []).some((f) => f.status === "verified");
    if (temAutenticador && context.claims.aal !== "aal2") throw new Error("Confirme primeiro o código do aplicativo autenticador.");

    const { data: u } = await supabaseAdmin.auth.admin.getUserById(context.userId);
    const email = u.user?.email ?? perfil.email;
    if (email && (await igualSenhaAtual(email, data.senha))) {
      throw new Error("A nova senha precisa ser diferente da senha temporária.");
    }

    const { error } = await supabaseAdmin.auth.admin.updateUserById(context.userId, { password: data.senha });
    if (error) throw new Error(/weak|pwned|leak/i.test(error.message) ? "Essa senha é muito comum ou já vazou na internet. Escolha outra." : error.message);
    await supabaseAdmin.from("profiles").update({ senha_temporaria: false }).eq("id", context.userId);

    const { registrarAuditoria } = await import("./auditoria.server");
    await registrarAuditoria(supabaseAdmin, {
      clinicaId: perfil.clinica_id,
      usuarioNome: perfil.nome ?? undefined,
      usuarioId: context.userId,
      acao: "definiu_senha",
      registroId: context.userId,
      descricao: [perfil.nome, perfil.email].filter(Boolean).join(" · "),
    });
    return { ok: true };
  });
