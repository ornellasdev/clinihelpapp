import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

// Avisos de pagamento enviados pelo Asaas. Cada clínica tem um token próprio (header asaas-access-token),
// conferido contra o hash salvo para a clínica dona da cobrança.
const corpoSchema = z.object({
  event: z.string().max(100),
  payment: z
    .object({
      id: z.string().max(100),
      status: z.string().max(60),
      value: z.number(),
      deleted: z.boolean().optional(),
      paymentDate: z.string().nullable().optional(),
      clientPaymentDate: z.string().nullable().optional(),
      confirmedDate: z.string().nullable().optional(),
    })
    .passthrough()
    .optional(),
});

export const Route = createFileRoute("/api/public/asaas/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = request.headers.get("asaas-access-token") ?? "";
        if (token.length < 32 || token.length > 255) return new Response("Unauthorized", { status: 401 });

        let corpo: z.infer<typeof corpoSchema>;
        try {
          corpo = corpoSchema.parse(await request.json());
        } catch {
          return new Response("Bad request", { status: 400 });
        }
        if (!corpo.payment) return new Response("ok");

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { sha256Hex, iguaisSeguro } = await import("@/lib/cripto.server");
        const hash = await sha256Hex(token);

        const { data: c } = await supabaseAdmin
          .from("cobrancas")
          .select("id, clinica_id, status, paciente_id, descricao")
          .eq("asaas_cobranca_id", corpo.payment.id)
          .maybeSingle();

        if (!c) {
          // Cobrança criada fora do CliniHelp: só aceita se o token for de alguma clínica.
          const { data: conta } = await supabaseAdmin.from("pagamento_contas").select("clinica_id").eq("webhook_token_hash", hash).maybeSingle();
          return conta ? new Response("ok") : new Response("Unauthorized", { status: 401 });
        }

        const { data: conta } = await supabaseAdmin
          .from("pagamento_contas")
          .select("webhook_token_hash")
          .eq("clinica_id", c.clinica_id)
          .maybeSingle();
        if (!conta || !iguaisSeguro(conta.webhook_token_hash, hash)) return new Response("Unauthorized", { status: 401 });

        const { aplicarSituacao } = await import("@/lib/pagamentos.server");
        const removida = corpo.event === "PAYMENT_DELETED" || corpo.payment.deleted === true;
        await aplicarSituacao(
          supabaseAdmin,
          c,
          { ...corpo.payment, deleted: removida },
          { usuarioNome: "Serviço de pagamentos" },
        );
        return new Response("ok");
      },
    },
  },
});
