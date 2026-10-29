import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { slugValido } from "./clinica-slug";

const ESPECIALIDADES_PADRAO = [
  ["Psicologia", "chart-1"],
  ["Fonoaudiologia", "chart-2"],
  ["Terapia Ocupacional", "chart-3"],
  ["Fisioterapia", "chart-4"],
  ["Psicomotricidade", "chart-5"],
  ["Musicoterapia", "chart-1"],
  ["Psicopedagogia", "chart-2"],
] as const;

/**
 * Garante que cada e-mail de desenvolvedor autorizado tenha uma conta, para que o login com Google funcione
 * (o cadastro público está desligado). Não recebe dados e não devolve nada: só prepara contas já autorizadas.
 */
export const prepararAcessoDev = createServerFn({ method: "POST" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: devs } = await supabaseAdmin.from("desenvolvedores").select("email");
  for (const d of devs ?? []) {
    const { data: existe } = await supabaseAdmin.from("profiles").select("id").ilike("email", d.email).maybeSingle();
    if (existe) continue;
    await supabaseAdmin.auth.admin.createUser({
      email: d.email,
      email_confirm: true,
      password: crypto.randomUUID() + crypto.randomUUID(),
      user_metadata: { nome: "Desenvolvedor CliniHelp" },
    });
  }
  return { ok: true };
});

async function exigirDev(supabase: any) {
  const { data } = await supabase.rpc("eh_dev");
  if (!data) throw new Error("Acesso de desenvolvedor com verificação em duas etapas necessário.");
}

export const listarClinicas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await exigirDev(context.supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: clinicas, error }, { data: perfis }, { data: pacientes }] = await Promise.all([
      supabaseAdmin.from("clinicas").select("*").order("nome"),
      supabaseAdmin.from("profiles").select("clinica_id").not("clinica_id", "is", null),
      supabaseAdmin.from("pacientes").select("clinica_id"),
    ]);
    if (error) throw new Error(error.message);
    const conta = (rows: { clinica_id: string | null }[] | null, id: string) =>
      (rows ?? []).filter((r) => r.clinica_id === id).length;
    return (clinicas ?? []).map((c) => ({
      ...c,
      equipe: conta(perfis, c.id),
      pacientes: conta(pacientes, c.id),
    }));
  });

const novaClinicaSchema = z.object({
  nome: z.string().trim().min(2).max(120),
  slug: z.string().trim().refine(slugValido, "Endereço inválido"),
  masterNome: z.string().trim().min(2).max(120),
  masterEmail: z.string().trim().email().max(255),
  masterSenha: z.string().min(8).max(72),
});

export const criarClinica = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.infer<typeof novaClinicaSchema>) => novaClinicaSchema.parse(input))
  .handler(async ({ data, context }) => {
    await exigirDev(context.supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: clinica, error } = await supabaseAdmin
      .from("clinicas")
      .insert({ nome: data.nome, slug: data.slug })
      .select()
      .single();
    if (error) {
      throw new Error(error.code === "23505" ? "Já existe uma clínica com esse endereço." : error.message);
    }

    const { data: created, error: userErr } = await supabaseAdmin.auth.admin.createUser({
      email: data.masterEmail,
      password: data.masterSenha,
      email_confirm: true,
      user_metadata: { nome: data.masterNome, clinica_id: clinica.id },
    });
    if (userErr || !created.user) {
      await supabaseAdmin.from("clinicas").delete().eq("id", clinica.id);
      throw new Error(
        userErr?.message?.includes("already") ? "Esse e-mail já tem uma conta no CliniHelp." : (userErr?.message ?? "Não foi possível criar o master."),
      );
    }
    const id = created.user.id;
    await supabaseAdmin
      .from("profiles")
      .upsert({ id, nome: data.masterNome, email: data.masterEmail, clinica_id: clinica.id });
    await supabaseAdmin.from("user_roles").insert({ user_id: id, role: "master", clinica_id: clinica.id });
    await supabaseAdmin
      .from("especialidades")
      .insert(ESPECIALIDADES_PADRAO.map(([nome, cor]) => ({ nome, cor, clinica_id: clinica.id })));

    const { registrarAuditoria } = await import("./auditoria.server");
    await registrarAuditoria(supabaseAdmin, {
      clinicaId: clinica.id,
      usuarioId: context.userId,
      usuarioNome: "Desenvolvedor CliniHelp",
      acao: "criou",
      registroId: id,
      descricao: `Clínica criada · master ${data.masterNome} · ${data.masterEmail}`,
      depois: { clinica: data.nome, endereco: data.slug, master: data.masterEmail },
    });
    return { slug: clinica.slug };
  });

export const definirClinicaAtiva = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; ativa: boolean }) =>
    z.object({ id: z.string().uuid(), ativa: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await exigirDev(context.supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("clinicas").update({ ativa: data.ativa }).eq("id", data.id);
    if (error) throw new Error(error.message);
    const { registrarAuditoria } = await import("./auditoria.server");
    await registrarAuditoria(supabaseAdmin, {
      clinicaId: data.id,
      usuarioId: context.userId,
      usuarioNome: "Desenvolvedor CliniHelp",
      acao: data.ativa ? "reativou" : "desativou",
      registroId: data.id,
      descricao: data.ativa ? "Acesso da clínica reativado" : "Acesso da clínica suspenso",
    });
    return { ok: true };
  });
