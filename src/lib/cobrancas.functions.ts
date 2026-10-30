import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { novaCobrancaSchema, type NovaCobranca } from "./cobranca-schema";
import {
  STATUS_QUE_PRENDEM_SESSAO,
  VALOR_MINIMO_COBRANCA,
  billingTypeAsaas,
  cpfValido,
  pagadorDoPaciente,
  podeCancelar,
  tipoPorSessoes,
  type StatusCobranca,
} from "./cobrancas";

async function exigirFinanceiro(supabase: any, userId: string): Promise<string> {
  const [{ data: gestor }, { data: fin }, { data: clinica }] = await Promise.all([
    supabase.rpc("is_gestor", { _user_id: userId }),
    supabase.rpc("has_role", { _user_id: userId, _role: "financeiro" }),
    supabase.rpc("minha_clinica"),
  ]);
  if (!gestor && !fin) throw new Error("Seu perfil não tem permissão para cobranças.");
  if (!clinica) throw new Error("Clínica não identificada.");
  return clinica as string;
}


export const criarCobranca = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: NovaCobranca) => {
    const r = novaCobrancaSchema.safeParse(input);
    if (!r.success) throw new Error(r.error.issues[0]?.message ?? "Dados da cobrança inválidos.");
    return r.data;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const clinicaId = await exigirFinanceiro(supabase, userId);

    const hoje = new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);
    if (data.vencimento < hoje) throw new Error("O vencimento não pode ser uma data passada.");

    const { data: paciente, error: pErr } = await supabase.from("pacientes").select("*").eq("id", data.pacienteId).maybeSingle();
    if (pErr || !paciente) throw new Error("Paciente não encontrado.");
    const pagador = pagadorDoPaciente(paciente);
    if (!pagador.nome) throw new Error("Cadastre o nome do responsável financeiro do paciente.");
    if (!cpfValido(pagador.cpf)) throw new Error("Cadastre um CPF válido do responsável financeiro do paciente.");

    const sessoes = [...new Set(data.sessoes)];
    if (sessoes.length) {
      const { data: ags } = await supabase
        .from("agendamentos")
        .select("id, status, paciente_id")
        .in("id", sessoes);
      if ((ags ?? []).length !== sessoes.length || ags!.some((a: any) => a.paciente_id !== data.pacienteId || ["cancelado", "falta_justificada", "falta_terapeuta"].includes(a.status))) {
        throw new Error("Alguma sessão escolhida não é deste paciente, foi cancelada ou é uma falta não cobrada.");
      }
      const { data: presas } = await supabase
        .from("cobranca_itens")
        .select("agendamento_id, cobranca:cobrancas!inner(status)")
        .in("agendamento_id", sessoes);
      if ((presas ?? []).some((p: any) => STATUS_QUE_PRENDEM_SESSAO.includes(p.cobranca.status))) {
        throw new Error("Alguma sessão escolhida já está em outra cobrança.");
      }
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { chaveDaClinica } = await import("./pagamentos.server");
    const { asaas } = await import("./asaas.server");
    const { tokenAleatorio } = await import("./cripto.server");
    const apiKey = await chaveDaClinica(supabaseAdmin, clinicaId);

    // Cliente (responsável) na conta da clínica. Avisos do Asaas desligados: quem envia é o CliniHelp.
    const dadosCliente = {
      name: pagador.nome,
      cpfCnpj: pagador.cpf,
      email: pagador.email ?? undefined,
      mobilePhone: pagador.telefone ?? undefined,
      notificationDisabled: true,
    };
    const busca = await asaas<{ data: { id: string }[] }>(apiKey, `/customers?cpfCnpj=${pagador.cpf}&limit=1`);
    let clienteId = busca.data?.[0]?.id;
    if (clienteId) await asaas(apiKey, `/customers/${clienteId}`, { method: "PUT", body: dadosCliente });
    else clienteId = (await asaas<{ id: string }>(apiKey, "/customers", { method: "POST", body: dadosCliente })).id;

    const id = crypto.randomUUID();
    const pg = await asaas<{ id: string }>(apiKey, "/payments", {
      method: "POST",
      body: {
        customer: clienteId,
        billingType: billingTypeAsaas(data.forma),
        value: data.valor,
        dueDate: data.vencimento,
        description: data.descricao,
        externalReference: id,
      },
    });

    const { error } = await supabase.from("cobrancas").insert({
      id,
      clinica_id: clinicaId,
      paciente_id: data.pacienteId,
      tipo: tipoPorSessoes(sessoes.length),
      descricao: data.descricao,
      valor: data.valor,
      vencimento: data.vencimento,
      forma: data.forma,
      pagador_nome: pagador.nome,
      pagador_cpf: pagador.cpf!,
      pagador_email: pagador.email,
      pagador_telefone: pagador.telefone,
      asaas_cobranca_id: pg.id,
      asaas_cliente_id: clienteId,
      token_publico: tokenAleatorio(),
    });
    if (error) {
      await asaas(apiKey, `/payments/${pg.id}`, { method: "DELETE" }).catch(() => undefined);
      throw new Error(error.message);
    }
    if (sessoes.length) {
      const { error: iErr } = await supabase
        .from("cobranca_itens")
        .insert(sessoes.map((agendamento_id) => ({ cobranca_id: id, agendamento_id, clinica_id: clinicaId })));
      if (iErr) console.error("Falha ao vincular sessões à cobrança:", iErr.message);
    }
    return { id };
  });

const idSchema = z.object({ id: z.string().uuid() });

async function carregar(supabase: any, id: string) {
  const { data, error } = await supabase
    .from("cobrancas")
    .select("id, clinica_id, status, paciente_id, descricao, asaas_cobranca_id")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) throw new Error("Cobrança não encontrada.");
  return data;
}

/** Consulta a situação no Asaas e atualiza (útil enquanto o aviso automático não chega). */
export const sincronizarCobranca = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.infer<typeof idSchema>) => idSchema.parse(input))
  .handler(async ({ data, context }) => {
    const clinicaId = await exigirFinanceiro(context.supabase, context.userId);
    const c = await carregar(context.supabase, data.id);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { chaveDaClinica, aplicarSituacao } = await import("./pagamentos.server");
    const { asaas } = await import("./asaas.server");
    const apiKey = await chaveDaClinica(supabaseAdmin, clinicaId);
    const pg = await asaas(apiKey, `/payments/${c.asaas_cobranca_id}`);
    const status = await aplicarSituacao(supabaseAdmin, c, pg, { usuarioId: context.userId });
    return { status };
  });

export const cancelarCobranca = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.infer<typeof idSchema>) => idSchema.parse(input))
  .handler(async ({ data, context }) => {
    const clinicaId = await exigirFinanceiro(context.supabase, context.userId);
    const c = await carregar(context.supabase, data.id);
    if (!podeCancelar(c.status as StatusCobranca)) throw new Error("Só é possível cancelar cobranças ainda não pagas.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { chaveDaClinica } = await import("./pagamentos.server");
    const { asaas } = await import("./asaas.server");
    const apiKey = await chaveDaClinica(supabaseAdmin, clinicaId);
    await asaas(apiKey, `/payments/${c.asaas_cobranca_id}`, { method: "DELETE" });
    const { error } = await context.supabase.from("cobrancas").update({ status: "cancelada" }).eq("id", c.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
