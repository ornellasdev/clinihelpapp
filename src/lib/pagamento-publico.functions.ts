import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { podePagar, type FormaCobranca, type StatusCobranca } from "./cobrancas";

// Funções públicas da página de pagamento: o acesso é pelo token secreto do link enviado ao responsável.
const tokenSchema = z.object({ token: z.string().regex(/^[A-Za-z0-9_-]{32,64}$/) });

async function buscarPorToken(token: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("cobrancas")
    .select("id, clinica_id, paciente_id, status, descricao, valor, vencimento, forma, pagador_nome, asaas_cobranca_id, pago_em, clinica:clinicas(nome, ativa), paciente:pacientes(nome)")
    .eq("token_publico", token)
    .maybeSingle();
  return { admin: supabaseAdmin, c: data };
}

export type PagamentoPublico = {
  clinica: string;
  paciente: string;
  descricao: string;
  valor: number;
  vencimento: string;
  status: StatusCobranca;
  forma: FormaCobranca;
  pagador: string;
  pagoEm: string | null;
  pix: { imagem: string; copiaECola: string } | null;
  boleto: { linhaDigitavel: string; pdf: string | null } | null;
  cartao: boolean;
};

export const obterPagamento = createServerFn({ method: "POST" })
  .inputValidator((input: z.infer<typeof tokenSchema>) => tokenSchema.parse(input))
  .handler(async ({ data }): Promise<PagamentoPublico | null> => {
    const { admin, c } = await buscarPorToken(data.token);
    if (!c || !(c.clinica as any)?.ativa) return null;

    const { chaveDaClinica, aplicarSituacao } = await import("./pagamentos.server");
    const { asaas } = await import("./asaas.server");
    const apiKey = await chaveDaClinica(admin, c.clinica_id);

    let status = c.status as StatusCobranca;
    let pdf: string | null = null;
    if (status !== "cancelada") {
      try {
        const pg = await asaas(apiKey, `/payments/${c.asaas_cobranca_id}`);
        status = await aplicarSituacao(admin, c, pg, { usuarioNome: "Serviço de pagamentos" });
        pdf = pg.bankSlipUrl ?? null;
      } catch (e) {
        console.error("Falha ao consultar cobrança:", (e as Error).message);
      }
    }

    const forma = c.forma as FormaCobranca;
    let pix: PagamentoPublico["pix"] = null;
    let boleto: PagamentoPublico["boleto"] = null;
    if (podePagar(status)) {
      if (forma === "pix" || forma === "todas" || forma === "boleto") {
        try {
          const q = await asaas<{ encodedImage: string; payload: string }>(apiKey, `/payments/${c.asaas_cobranca_id}/pixQrCode`);
          if (q?.payload) pix = { imagem: q.encodedImage, copiaECola: q.payload };
        } catch {
          /* Pix indisponível para esta cobrança */
        }
      }
      if (forma === "boleto" || forma === "todas") {
        try {
          const b = await asaas<{ identificationField: string }>(apiKey, `/payments/${c.asaas_cobranca_id}/identificationField`);
          if (b?.identificationField) boleto = { linhaDigitavel: b.identificationField, pdf };
        } catch {
          /* boleto indisponível */
        }
      }
    }

    return {
      clinica: (c.clinica as any)?.nome ?? "",
      paciente: (c.paciente as any)?.nome ?? "",
      descricao: c.descricao,
      valor: Number(c.valor),
      vencimento: c.vencimento,
      status,
      forma,
      pagador: c.pagador_nome,
      pagoEm: c.pago_em,
      pix,
      boleto,
      cartao: podePagar(status) && (forma === "cartao" || forma === "todas"),
    };
  });

const cartaoSchema = tokenSchema.extend({
  cartao: z.object({
    nome: z.string().trim().min(2).max(100),
    numero: z.string().regex(/^\d{13,19}$/),
    mes: z.string().regex(/^(0[1-9]|1[0-2])$/),
    ano: z.string().regex(/^\d{4}$/),
    cvv: z.string().regex(/^\d{3,4}$/),
  }),
  titular: z.object({
    nome: z.string().trim().min(2).max(100),
    email: z.string().trim().email().max(255),
    cpf: z.string().regex(/^\d{11}$|^\d{14}$/),
    cep: z.string().regex(/^\d{8}$/),
    numero: z.string().trim().min(1).max(20),
    telefone: z.string().regex(/^\d{10,11}$/),
  }),
});

/** Paga com cartão: os dados do cartão vão direto ao Asaas e nunca são gravados nem registrados. */
export const pagarComCartao = createServerFn({ method: "POST" })
  .inputValidator((input: z.infer<typeof cartaoSchema>) => cartaoSchema.parse(input))
  .handler(async ({ data }) => {
    const { admin, c } = await buscarPorToken(data.token);
    if (!c || !(c.clinica as any)?.ativa) throw new Error("Cobrança não encontrada.");
    if (!podePagar(c.status as StatusCobranca) || !(c.forma === "cartao" || c.forma === "todas")) {
      throw new Error("Esta cobrança não aceita pagamento com cartão agora.");
    }
    const { chaveDaClinica, aplicarSituacao } = await import("./pagamentos.server");
    const { asaas, ErroAsaas } = await import("./asaas.server");
    const apiKey = await chaveDaClinica(admin, c.clinica_id);
    try {
      const pg = await asaas(apiKey, `/payments/${c.asaas_cobranca_id}/payWithCreditCard`, {
        method: "POST",
        body: {
          creditCard: {
            holderName: data.cartao.nome,
            number: data.cartao.numero,
            expiryMonth: data.cartao.mes,
            expiryYear: data.cartao.ano,
            ccv: data.cartao.cvv,
          },
          creditCardHolderInfo: {
            name: data.titular.nome,
            email: data.titular.email,
            cpfCnpj: data.titular.cpf,
            postalCode: data.titular.cep,
            addressNumber: data.titular.numero,
            phone: data.titular.telefone,
          },
        },
      });
      const status = await aplicarSituacao(admin, c, pg, { usuarioNome: "Serviço de pagamentos" });
      return { status };
    } catch (e) {
      if (e instanceof ErroAsaas && e.status < 500) throw new Error(e.message);
      throw new Error("Não foi possível processar o cartão agora. Tente novamente.");
    }
  });
