import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { TEXTO_LGPD_ANAMNESE, VERSAO_ANAMNESE, validarAnamnese } from "./anamnese";

async function sha256(texto: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const envioSchema = z.object({
  pacienteId: z.string().uuid(),
  respostas: z.record(z.string().max(60), z.union([z.string().max(5000), z.array(z.string().max(80)).max(20)])),
  nome: z.string().trim().min(3, "Informe seu nome completo.").max(150),
  parentesco: z.string().trim().min(2, "Informe o parentesco.").max(40),
  aceite: z.literal(true, "Confirme a declaração para enviar."),
});

/**
 * Responsável envia a entrevista inicial. O vínculo com a criança é conferido com a sessão dele (RPC);
 * a gravação (anamnese + avaliação concluída, na mesma transação) é feita pelo servidor.
 */
export const enviarAnamnese = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => {
    const r = envioSchema.safeParse(d);
    if (!r.success) throw new Error(r.error.issues[0]?.message ?? "Dados do formulário inválidos.");
    return r.data;
  })
  .handler(async ({ data, context }) => {
    const { data: linhas, error } = await context.supabase.rpc("familia_avaliacao", { _paciente: data.pacienteId });
    if (error) throw new Error("Não foi possível conferir o formulário.");
    const av = linhas?.[0];
    if (!av) throw new Error("Formulário não encontrado.");
    if (av.status === "concluida") throw new Error("Este formulário já foi enviado.");
    if (av.status !== "aguardando_formulario") throw new Error("O formulário ainda não foi liberado pela clínica.");

    const v = validarAnamnese(data.respostas);
    if (!v.ok) throw new Error(v.mensagem);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: user } = await supabaseAdmin.auth.admin.getUserById(context.userId);
    const email = user.user?.email ?? null;
    const nome = data.nome.replace(/\s+/g, " ");
    const parentesco = data.parentesco.replace(/\s+/g, " ");
    const ip = (getRequestHeader("cf-connecting-ip") ?? getRequestHeader("x-forwarded-for") ?? "").split(",")[0]!.trim() || null;
    const userAgent = (getRequestHeader("user-agent") ?? "").slice(0, 400) || null;
    const lgpdHash = await sha256(TEXTO_LGPD_ANAMNESE);
    const enviadoEm = new Date().toISOString();
    const comprovante = await sha256(
      [data.pacienteId, VERSAO_ANAMNESE, await sha256(JSON.stringify(v.respostas)), lgpdHash, nome, parentesco, email, enviadoEm].join("|"),
    );

    const { data: preenchidoEm, error: e2 } = await supabaseAdmin.rpc("registrar_anamnese", {
      _paciente: data.pacienteId,
      _versao: VERSAO_ANAMNESE,
      _respostas: v.respostas,
      _usuario: context.userId,
      _nome: nome,
      _parentesco: parentesco,
      _email: email ?? "",
      _lgpd_hash: lgpdHash,
      _ip: ip ?? "",
      _user_agent: userAgent ?? "",
      _comprovante: comprovante,
    });
    if (e2) {
      console.error("[anamnese] registrar", e2.message);
      throw new Error(/não está disponível/.test(e2.message) ? "Este formulário já foi enviado." : "Não foi possível enviar o formulário. Tente novamente.");
    }
    return { preenchidoEm: preenchidoEm as string, comprovante };
  });
