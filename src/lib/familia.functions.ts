import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { somenteDigitos } from "./cobrancas";
import { normalizarEmail, validarAssinatura } from "./familia";

const MSG_ENVIO = "Se este e-mail estiver na ficha de uma criança, enviamos um código de acesso. Confira também a caixa de spam.";

async function sha256(texto: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Público: envia o código de acesso somente se o e-mail estiver cadastrado como responsável
 * em alguma ficha ativa. A resposta é sempre a mesma, para não revelar quais e-mails existem.
 */
export const enviarCodigoFamilia = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ email: z.string().email().max(200) }).parse(d))
  .handler(async ({ data }) => {
    const email = normalizarEmail(data.email);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const filtro = email.replace(/[\\%_]/g, (c) => `\\${c}`);
    const { data: pacientes } = await supabaseAdmin
      .from("pacientes")
      .select("id, clinica:clinicas!inner(ativa)")
      .eq("ativo", true)
      .eq("clinica.ativa", true)
      .or(`responsavel_email.ilike.${filtro},responsavel2_email.ilike.${filtro},responsavel_financeiro_email.ilike.${filtro}`)
      .limit(1);
    if (!pacientes?.length) return { mensagem: MSG_ENVIO };

    // Conta do responsável (sem senha, sem clínica): criada só aqui, depois da conferência acima.
    const { error: criar } = await supabaseAdmin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { nome: email.split("@")[0], tipo: "responsavel" },
    });
    if (criar && !/already|registered|exists/i.test(criar.message)) {
      console.error("[familia] criar conta", criar.message);
      throw new Error("Não foi possível enviar o código agora. Tente novamente em instantes.");
    }
    if (criar) {
      // Conta já existente: se for da equipe de uma clínica, não entra pela Área da família.
      const { data: perfil } = await supabaseAdmin.from("profiles").select("clinica_id").ilike("email", filtro).maybeSingle();
      if (perfil?.clinica_id) return { mensagem: MSG_ENVIO };
    }

    const url = process.env["SUPABASE_URL"]!;
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
    const anon = createClient(url, key, {
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
    const origem = getRequestHeader("origin");
    const { error } = await anon.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false, ...(origem ? { emailRedirectTo: `${origem}/familia` } : {}) },
    });
    if (error) {
      if (/rate|seconds|security purposes/i.test(error.message)) throw new Error("Aguarde um minuto antes de pedir outro código.");
      console.error("[familia] otp", error.message);
      throw new Error("Não foi possível enviar o código agora. Tente novamente em instantes.");
    }
    return { mensagem: MSG_ENVIO };
  });

const assinarSchema = z.object({
  termoId: z.string().uuid(),
  pacienteId: z.string().uuid(),
  nome: z.string().min(3).max(150),
  cpf: z.string().max(20),
  parentesco: z.string().min(2).max(40),
  decisao: z.enum(["concordo", "autorizo", "nao_autorizo"]),
  assinatura: z.string().max(300_000),
});

/** Responsável assina o termo. A conferência de vínculo usa a sessão dele (RPC); a gravação é feita pelo servidor. */
export const assinarTermo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => assinarSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { data: termos, error } = await context.supabase.rpc("familia_termos", { _paciente: data.pacienteId });
    if (error) throw new Error("Não foi possível conferir o termo.");
    const termo = termos?.find((t) => t.id === data.termoId);
    if (!termo) throw new Error("Termo não encontrado.");
    if (termo.status !== "pendente") throw new Error("Este termo já foi assinado.");
    const erro = validarAssinatura({ ...data, tipo: termo.tipo });
    if (erro) throw new Error(erro);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: user } = await supabaseAdmin.auth.admin.getUserById(context.userId);
    const { data: atual } = await supabaseAdmin
      .from("termos_assinaturas")
      .select("texto_hash, status")
      .eq("id", data.termoId)
      .single();
    if (!atual || atual.status !== "pendente") throw new Error("Este termo já foi assinado.");

    const assinadoEm = new Date().toISOString();
    const cpf = somenteDigitos(data.cpf);
    const nome = data.nome.trim().replace(/\s+/g, " ");
    const email = user.user?.email ?? null;
    const ip = (getRequestHeader("cf-connecting-ip") ?? getRequestHeader("x-forwarded-for") ?? "").split(",")[0]!.trim() || null;
    const userAgent = (getRequestHeader("user-agent") ?? "").slice(0, 400) || null;
    const comprovante = await sha256(
      [data.termoId, atual.texto_hash, nome, cpf, data.parentesco, data.decisao, email, assinadoEm, await sha256(data.assinatura)].join("|"),
    );

    const { error: e2, count } = await supabaseAdmin
      .from("termos_assinaturas")
      .update(
        {
          status: "assinado",
          assinado_em: assinadoEm,
          assinante_user_id: context.userId,
          assinante_nome: nome,
          assinante_cpf: cpf,
          assinante_email: email,
          assinante_parentesco: data.parentesco,
          decisao: data.decisao,
          assinatura_imagem: data.assinatura,
          ip,
          user_agent: userAgent,
          comprovante_hash: comprovante,
        },
        { count: "exact" },
      )
      .eq("id", data.termoId)
      .eq("status", "pendente");
    if (e2 || !count) throw new Error("Não foi possível registrar a assinatura. Tente novamente.");
    return { ok: true, comprovante };
  });

/** Comprovante completo (com assinatura) de um termo do próprio filho. */
export const comprovanteTermoFamilia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ termoId: z.string().uuid(), pacienteId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: termos } = await context.supabase.rpc("familia_termos", { _paciente: data.pacienteId });
    const t = termos?.find((x) => x.id === data.termoId && x.status === "assinado");
    if (!t) throw new Error("Termo assinado não encontrado.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("termos_assinaturas")
      .select("titulo, tipo, texto, texto_hash, assinado_em, assinante_nome, assinante_cpf, assinante_email, assinante_parentesco, decisao, assinatura_imagem, ip, user_agent, comprovante_hash")
      .eq("id", data.termoId)
      .single();
    if (!row) throw new Error("Termo assinado não encontrado.");
    return { ...row, clinica: t.clinica_nome, paciente: t.paciente_nome };
  });

/** Link temporário (5 min) para baixar um relatório liberado ao responsável. */
export const baixarRelatorioFamilia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), pacienteId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: lista } = await context.supabase.rpc("familia_relatorios", { _paciente: data.pacienteId });
    if (!lista?.some((r) => r.id === data.id)) throw new Error("Relatório não encontrado.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: r } = await supabaseAdmin.from("relatorios_liberados").select("storage_path").eq("id", data.id).single();
    if (!r) throw new Error("Relatório não encontrado.");
    const { data: s, error } = await supabaseAdmin.storage.from("relatorios-familia").createSignedUrl(r.storage_path, 300, { download: true });
    if (error || !s) throw new Error("Não foi possível abrir o relatório.");
    return { url: s.signedUrl };
  });
