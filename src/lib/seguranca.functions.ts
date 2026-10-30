import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
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
 * Troca a senha com a sessão da própria pessoa (mantém o login ativo e o servidor de login recusa repetir a senha atual).
 * Retorna null quando deu certo ou o código de erro do servidor de login.
 */
async function trocarComSessao(senha: string): Promise<{ codigo: string; mensagem: string } | null> {
  const url = process.env["SUPABASE_URL"]!;
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  const authorization = getRequest()?.headers.get("authorization") ?? "";
  const res = await fetch(`${url}/auth/v1/user`, {
    method: "PUT",
    headers: { apikey: key, Authorization: authorization, "Content-Type": "application/json" },
    body: JSON.stringify({ password: senha }),
  });
  if (res.ok) return null;
  const corpo = (await res.json().catch(() => ({}))) as { error_code?: string; code?: string | number; msg?: string; message?: string };
  return { codigo: String(corpo.error_code ?? corpo.code ?? res.status), mensagem: corpo.msg ?? corpo.message ?? "" };
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

    // relogin = a troca encerrou as sessões e o navegador precisa entrar de novo com a nova senha.
    let relogin = false;
    const falha = await trocarComSessao(data.senha);
    if (falha) {
      console.warn("[seguranca] troca com sessão recusada:", falha.codigo, falha.mensagem);
      if (/same_password|different from the old/i.test(`${falha.codigo} ${falha.mensagem}`)) {
        throw new Error("A nova senha precisa ser diferente da senha temporária.");
      }
      if (/weak_password|pwned|leak/i.test(`${falha.codigo} ${falha.mensagem}`)) {
        throw new Error("Essa senha é muito comum ou já vazou na internet. Escolha outra.");
      }
      if (!/reauth|current_password|current password/i.test(`${falha.codigo} ${falha.mensagem}`)) {
        console.error("[seguranca] troca de senha", falha.codigo, falha.mensagem);
        throw new Error("Não foi possível salvar a senha agora. Tente novamente.");
      }
      // O servidor de login exige a senha atual: troca pelo acesso administrativo, conferindo antes que não repete a temporária.
      const { data: u } = await supabaseAdmin.auth.admin.getUserById(context.userId);
      const email = u.user?.email ?? perfil.email;
      if (email && (await igualSenhaAtual(email, data.senha))) {
        throw new Error("A nova senha precisa ser diferente da senha temporária.");
      }
      const { error } = await supabaseAdmin.auth.admin.updateUserById(context.userId, { password: data.senha });
      if (error) throw new Error(error.message);
      relogin = true;
    }
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
    return { ok: true, relogin };
  });
