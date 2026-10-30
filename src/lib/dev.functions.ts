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

// Contas de desenvolvedor são criadas pela equipe CliniHelp ao autorizar o e-mail (fora do app);
// nenhuma função pública cria contas.

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

const recebimentosSchema = z.object({
  clinicaId: z.string().uuid(),
  nome: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(255),
  cpfCnpj: z.string().regex(/^\d{11}$|^\d{14}$/),
  nascimento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  tipoEmpresa: z.enum(["MEI", "LIMITED", "INDIVIDUAL", "ASSOCIATION"]).optional(),
  celular: z.string().regex(/^\d{10,11}$/),
  faturamento: z.number().positive().max(1_000_000_000),
  cep: z.string().regex(/^\d{8}$/),
  endereco: z.string().trim().min(2).max(200),
  numero: z.string().trim().min(1).max(20),
  complemento: z.string().trim().max(100).optional(),
  bairro: z.string().trim().min(2).max(100),
});

/** Cria a conta de recebimento da clínica no Asaas (subconta da conta-mãe do desenvolvedor) e liga os avisos de pagamento. */
export const ativarRecebimentos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.infer<typeof recebimentosSchema>) => recebimentosSchema.parse(input))
  .handler(async ({ data, context }) => {
    await exigirDev(context.supabase);
    const chaveMae = process.env["ASAAS_API_KEY"];
    if (!chaveMae) throw new Error("A chave da conta Asaas do CliniHelp ainda não foi cadastrada.");
    const pj = data.cpfCnpj.length === 14;
    if (pj && !data.tipoEmpresa) throw new Error("Informe o tipo de empresa.");
    if (!pj && !data.nascimento) throw new Error("Informe a data de nascimento do titular.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existente } = await supabaseAdmin.from("pagamento_contas").select("clinica_id").eq("clinica_id", data.clinicaId).maybeSingle();
    if (existente) throw new Error("Esta clínica já tem recebimentos ativados.");
    const { data: clinica } = await supabaseAdmin.from("clinicas").select("id, nome").eq("id", data.clinicaId).maybeSingle();
    if (!clinica) throw new Error("Clínica não encontrada.");

    const { asaas, ambienteDaChave } = await import("./asaas.server");
    const { cifrar, sha256Hex, tokenAleatorio } = await import("./cripto.server");
    const { URL_WEBHOOK_ASAAS } = await import("./cobrancas");
    const tokenAviso = tokenAleatorio(36);

    const conta = await asaas<{ id: string; apiKey: string; walletId: string }>(chaveMae, "/accounts", {
      method: "POST",
      body: {
        name: data.nome,
        email: data.email,
        cpfCnpj: data.cpfCnpj,
        birthDate: pj ? undefined : data.nascimento,
        companyType: pj ? data.tipoEmpresa : undefined,
        mobilePhone: data.celular,
        incomeValue: data.faturamento,
        address: data.endereco,
        addressNumber: data.numero,
        complement: data.complemento || undefined,
        province: data.bairro,
        postalCode: data.cep,
        webhooks: [
          {
            name: "CliniHelp",
            url: URL_WEBHOOK_ASAAS,
            email: data.email,
            sendType: "SEQUENTIALLY",
            interrupted: false,
            enabled: true,
            apiVersion: 3,
            authToken: tokenAviso,
            events: [
              "PAYMENT_CONFIRMED",
              "PAYMENT_RECEIVED",
              "PAYMENT_OVERDUE",
              "PAYMENT_DELETED",
              "PAYMENT_RESTORED",
              "PAYMENT_REFUNDED",
              "PAYMENT_AWAITING_RISK_ANALYSIS",
              "PAYMENT_APPROVED_BY_RISK_ANALYSIS",
              "PAYMENT_REPROVED_BY_RISK_ANALYSIS",
              "PAYMENT_RECEIVED_IN_CASH_UNDONE",
              "PAYMENT_CHARGEBACK_REQUESTED",
              "PAYMENT_CHARGEBACK_DISPUTE",
            ],
          },
        ],
      },
    });
    if (!conta?.apiKey) throw new Error("O Asaas não devolveu a chave da conta da clínica.");

    const { error } = await supabaseAdmin.from("pagamento_contas").insert({
      clinica_id: data.clinicaId,
      asaas_conta_id: conta.id,
      asaas_wallet_id: conta.walletId,
      api_key_cripto: await cifrar(conta.apiKey),
      webhook_token_hash: await sha256Hex(tokenAviso),
      ambiente: ambienteDaChave(chaveMae),
      titular_nome: data.nome,
      titular_documento: data.cpfCnpj,
    });
    if (error) {
      console.error("Conta Asaas criada mas não salva:", conta.id, error.message);
      throw new Error("A conta foi criada no Asaas, mas não foi salva no CliniHelp. Avise o suporte antes de tentar de novo.");
    }
    await supabaseAdmin.from("clinicas").update({ pagamentos_ativos: true }).eq("id", data.clinicaId);

    const { registrarAuditoria } = await import("./auditoria.server");
    await registrarAuditoria(supabaseAdmin, {
      clinicaId: data.clinicaId,
      usuarioId: context.userId,
      usuarioNome: "Desenvolvedor CliniHelp",
      acao: "criou",
      tabela: "cobrancas",
      registroId: conta.id,
      descricao: `Recebimentos ativados · titular ${data.nome}`,
    });
    return { ok: true };
  });

/** Situação da conta de recebimento da clínica (aprovação de documentos). */
export const situacaoRecebimentos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { clinicaId: string }) => z.object({ clinicaId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await exigirDev(context.supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: conta } = await supabaseAdmin
      .from("pagamento_contas")
      .select("ambiente, titular_nome, titular_documento, created_at")
      .eq("clinica_id", data.clinicaId)
      .maybeSingle();
    if (!conta) return null;
    const { chaveDaClinica } = await import("./pagamentos.server");
    const { asaas } = await import("./asaas.server");
    let geral: string | null = null;
    try {
      const st = await asaas<{ general?: string }>(await chaveDaClinica(supabaseAdmin, data.clinicaId), "/myAccount/status/");
      geral = st.general ?? null;
    } catch (e) {
      console.error("Falha ao consultar situação da conta:", (e as Error).message);
    }
    return { ...conta, geral };
  });
