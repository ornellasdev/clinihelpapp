import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Cada clínica conecta a própria conta Asaas colando a chave de API. A chave fica criptografada e só o servidor a lê.

const EVENTOS = [
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
];

async function contexto(supabase: any, userId: string) {
  const [{ data: gestor }, { data: fin }, { data: clinica }] = await Promise.all([
    supabase.rpc("is_gestor", { _user_id: userId }),
    supabase.rpc("has_role", { _user_id: userId, _role: "financeiro" }),
    supabase.rpc("minha_clinica"),
  ]);
  if (!clinica) throw new Error("Clínica não identificada.");
  return { clinicaId: clinica as string, gestor: !!gestor, financeiro: !!fin };
}

const mascarar = (doc: string | null) =>
  !doc ? null : doc.length === 14 ? `${doc.slice(0, 2)}.***.***/${doc.slice(8, 12)}-**` : `***.${doc.slice(3, 6)}.***-**`;

/** Situação da conta Asaas conectada pela clínica (gestão e financeiro). */
export const minhaContaRecebimento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const c = await contexto(context.supabase, context.userId);
    if (!c.gestor && !c.financeiro) throw new Error("Seu perfil não tem permissão para cobranças.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("pagamento_contas")
      .select("ambiente, titular_nome, titular_documento, created_at")
      .eq("clinica_id", c.clinicaId)
      .maybeSingle();
    if (!data) return null;
    return { ambiente: data.ambiente, titular: data.titular_nome, documento: mascarar(data.titular_documento), conectadaEm: data.created_at };
  });

const chaveSchema = z.object({ apiKey: z.string().trim().regex(/^\$aact_(prod|hmlg)_[A-Za-z0-9:$_\-=]{20,400}$/, "Chave do Asaas inválida") });

export const conectarAsaas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.infer<typeof chaveSchema>) => chaveSchema.parse(input))
  .handler(async ({ data, context }) => {
    const c = await contexto(context.supabase, context.userId);
    if (!c.gestor) throw new Error("Só o master ou o administrador da clínica podem conectar a conta Asaas.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { asaas, ambienteDaChave } = await import("./asaas.server");
    const { cifrar, decifrar, sha256Hex, tokenAleatorio } = await import("./cripto.server");
    const { URL_WEBHOOK_ASAAS } = await import("./cobrancas");

    const info = await asaas<{ name?: string; companyName?: string; cpfCnpj?: string; email?: string }>(data.apiKey, "/myAccount/commercialInfo/");
    const carteiras = await asaas<{ data: { id: string }[] }>(data.apiKey, "/wallets/");
    const walletId = carteiras.data?.[0]?.id ?? "propria";

    const { data: atual } = await supabaseAdmin
      .from("pagamento_contas")
      .select("asaas_conta_id, api_key_cripto, webhook_id")
      .eq("clinica_id", c.clinicaId)
      .maybeSingle();
    if (atual && atual.asaas_conta_id !== walletId) {
      const { count } = await supabaseAdmin
        .from("cobrancas")
        .select("id", { count: "exact", head: true })
        .eq("clinica_id", c.clinicaId)
        .in("status", ["pendente", "vencido", "em_analise"]);
      if (count) throw new Error("Há cobranças em aberto na conta atual. Conclua ou cancele essas cobranças antes de trocar de conta Asaas.");
    }

    // Aviso automático de pagamento na conta da clínica.
    const tokenAviso = tokenAleatorio(36);
    const webhook = await asaas<{ id: string }>(data.apiKey, "/webhooks", {
      method: "POST",
      body: {
        name: "CliniHelp",
        url: URL_WEBHOOK_ASAAS,
        email: info.email ?? undefined,
        sendType: "SEQUENTIALLY",
        interrupted: false,
        enabled: true,
        apiVersion: 3,
        authToken: tokenAviso,
        events: EVENTOS,
      },
    });

    const linha = {
      clinica_id: c.clinicaId,
      asaas_conta_id: walletId,
      asaas_wallet_id: walletId,
      api_key_cripto: await cifrar(data.apiKey),
      webhook_token_hash: await sha256Hex(tokenAviso),
      webhook_id: webhook?.id ?? null,
      ambiente: ambienteDaChave(data.apiKey),
      titular_nome: info.companyName || info.name || null,
      titular_documento: info.cpfCnpj ?? null,
      conectada_por: context.userId,
      created_at: new Date().toISOString(),
    };
    const { error } = await supabaseAdmin.from("pagamento_contas").upsert(linha, { onConflict: "clinica_id" });
    if (error) {
      if (webhook?.id) await asaas(data.apiKey, `/webhooks/${webhook.id}`, { method: "DELETE" }).catch(() => undefined);
      throw new Error(error.message);
    }
    // Remove o aviso antigo da conexão anterior.
    if (atual?.webhook_id) {
      try {
        await asaas(await decifrar(atual.api_key_cripto), `/webhooks/${atual.webhook_id}`, { method: "DELETE" });
      } catch {
        /* conta antiga inacessível */
      }
    }
    await supabaseAdmin.from("clinicas").update({ pagamentos_ativos: true }).eq("id", c.clinicaId);

    const { registrarAuditoria } = await import("./auditoria.server");
    await registrarAuditoria(supabaseAdmin, {
      clinicaId: c.clinicaId,
      usuarioId: context.userId,
      acao: atual ? "alterou" : "criou",
      tabela: "cobrancas",
      registroId: walletId,
      descricao: `Conta Asaas ${atual ? "trocada" : "conectada"} · ${linha.titular_nome ?? ""} · ${linha.ambiente === "sandbox" ? "teste" : "real"}`,
    });
    return { titular: linha.titular_nome, ambiente: linha.ambiente };
  });

export const desconectarAsaas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const c = await contexto(context.supabase, context.userId);
    if (!c.gestor) throw new Error("Só o master ou o administrador da clínica podem desconectar a conta Asaas.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count } = await supabaseAdmin
      .from("cobrancas")
      .select("id", { count: "exact", head: true })
      .eq("clinica_id", c.clinicaId)
      .in("status", ["pendente", "vencido", "em_analise"]);
    if (count) throw new Error("Há cobranças em aberto. Conclua ou cancele essas cobranças antes de desconectar.");
    const { data: atual } = await supabaseAdmin
      .from("pagamento_contas")
      .select("api_key_cripto, webhook_id")
      .eq("clinica_id", c.clinicaId)
      .maybeSingle();
    if (atual?.webhook_id) {
      const { asaas } = await import("./asaas.server");
      const { decifrar } = await import("./cripto.server");
      try {
        await asaas(await decifrar(atual.api_key_cripto), `/webhooks/${atual.webhook_id}`, { method: "DELETE" });
      } catch {
        /* segue mesmo assim */
      }
    }
    await supabaseAdmin.from("pagamento_contas").delete().eq("clinica_id", c.clinicaId);
    await supabaseAdmin.from("clinicas").update({ pagamentos_ativos: false }).eq("id", c.clinicaId);
    const { registrarAuditoria } = await import("./auditoria.server");
    await registrarAuditoria(supabaseAdmin, {
      clinicaId: c.clinicaId,
      usuarioId: context.userId,
      acao: "removeu",
      tabela: "cobrancas",
      registroId: c.clinicaId,
      descricao: "Conta Asaas desconectada",
    });
    return { ok: true };
  });
