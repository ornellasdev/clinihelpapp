/** Regras de servidor das cobranças: chave da clínica e aplicação da situação vinda do Asaas. */
import { efeitoNasSessoes, statusDoAsaas, type StatusCobranca } from "./cobrancas";
import type { PagamentoAsaas } from "./asaas.server";

export async function chaveDaClinica(admin: any, clinicaId: string): Promise<string> {
  const { data, error } = await admin.from("pagamento_contas").select("api_key_cripto").eq("clinica_id", clinicaId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Os recebimentos desta clínica ainda não foram ativados. Fale com o suporte CliniHelp.");
  const { decifrar } = await import("./cripto.server");
  return decifrar(data.api_key_cripto);
}

type CobrancaBase = { id: string; clinica_id: string; status: string; paciente_id: string; descricao: string };

/** Atualiza a cobrança com o que o Asaas informa e reflete o pagamento nas sessões do Financeiro. */
export async function aplicarSituacao(
  admin: any,
  cobranca: CobrancaBase,
  pg: Pick<PagamentoAsaas, "status" | "value" | "deleted" | "paymentDate" | "clientPaymentDate" | "confirmedDate">,
  origem: { usuarioId?: string | null; usuarioNome?: string },
): Promise<StatusCobranca> {
  const anterior = cobranca.status as StatusCobranca;
  const novo = statusDoAsaas(pg.status, !!pg.deleted);
  if (novo === anterior) return novo;

  const pagoEm = pg.clientPaymentDate ?? pg.paymentDate ?? pg.confirmedDate ?? null;
  const patch: Record<string, unknown> = { status: novo };
  if (novo === "pago") {
    patch.pago_em = pagoEm ? new Date(`${pagoEm}T12:00:00-03:00`).toISOString() : new Date().toISOString();
    patch.valor_pago = pg.value;
  }
  const { error } = await admin.from("cobrancas").update(patch).eq("id", cobranca.id).eq("clinica_id", cobranca.clinica_id);
  if (error) throw new Error(error.message);

  const efeito = efeitoNasSessoes(anterior, novo);
  if (efeito) {
    const { data: itens } = await admin.from("cobranca_itens").select("agendamento_id").eq("cobranca_id", cobranca.id);
    const ids = (itens ?? []).map((i: { agendamento_id: string }) => i.agendamento_id);
    if (ids.length) {
      await admin
        .from("atendimento_financeiro")
        .update({ pagamento_status: efeito })
        .in("agendamento_id", ids)
        .eq("clinica_id", cobranca.clinica_id);
    }
  }

  const { registrarAuditoria } = await import("./auditoria.server");
  await registrarAuditoria(admin, {
    clinicaId: cobranca.clinica_id,
    usuarioId: origem.usuarioId ?? null,
    usuarioNome: origem.usuarioNome,
    acao: "alterou",
    tabela: "cobrancas",
    registroId: cobranca.id,
    descricao: `${cobranca.descricao} · situação atualizada pelo serviço de pagamentos`,
    campos: ["status"],
    antes: { status: anterior },
    depois: { status: novo },
  });
  return novo;
}
