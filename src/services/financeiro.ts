// Domínio Financeiro: tabela de convênios, valores e repasses por sessão, e repasse padrão do profissional.
// Tudo validado com Zod antes de ir ao banco (que ainda confere as mesmas faixas por regra própria).
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { erroAmigavel } from "@/lib/ui-helpers";
import { percentualRepasse, valorReais } from "@/lib/validacao";
import { ErroServico, garantir, semIndefinidos, validar } from "./resultado";

const mensagemConvenio = (msg: string) =>
  msg.includes("convenios_nome_unico") ? "Já existe um convênio com esse nome." : erroAmigavel(msg);

const comMensagemConvenio = <T>(res: { data: T | null; error: { message: string } | null }) => {
  if (res.error) throw new ErroServico(mensagemConvenio(res.error.message));
  return res.data as T;
};

// ---------- Convênios ----------
export const TIPOS_CONVENIO_VALIDOS = ["convenio", "particular", "liminar"] as const;

export const convenioSchema = z.object({
  nome: z.string().trim().min(2, "Nome do convênio: pelo menos 2 letras.").max(80, "Nome do convênio: no máximo 80 caracteres."),
  tipo: z.enum(TIPOS_CONVENIO_VALIDOS, "Tipo inválido."),
  valor: valorReais("Valor da sessão"),
});
export type NovoConvenio = z.input<typeof convenioSchema>;

export async function criarConvenio(entrada: NovoConvenio) {
  const d = validar(convenioSchema, entrada);
  const { data: criado, error } = await supabase.from("convenios").insert({ nome: d.nome, tipo: d.tipo }).select("id").single();
  if (error || !criado) throw new ErroServico(mensagemConvenio(error?.message ?? "Não foi possível criar o convênio."));
  comMensagemConvenio(await supabase.from("convenio_valores").insert({ convenio_id: criado.id, valor_sessao: d.valor }));
}

const alteracaoConvenioSchema = convenioSchema.pick({ nome: true, tipo: true }).partial().extend({ ativo: z.boolean().optional() });

export async function atualizarConvenio(id: string, patch: z.input<typeof alteracaoConvenioSchema>) {
  const d = validar(alteracaoConvenioSchema, patch);
  comMensagemConvenio(await supabase.from("convenios").update(semIndefinidos(d)).eq("id", id));
}

export async function definirValorConvenio(id: string, valor: string | number) {
  const v = validar(z.object({ valor: valorReais("Valor da sessão") }), { valor }).valor;
  comMensagemConvenio(
    await supabase.from("convenio_valores").upsert({ convenio_id: id, valor_sessao: v, updated_at: new Date().toISOString() }),
  );
}

export async function removerConvenio(id: string) {
  comMensagemConvenio(await supabase.from("convenios").delete().eq("id", id));
}

// ---------- Valores e repasse de cada sessão ----------
export const ajusteSessaoSchema = z
  .object({
    valor: valorReais("Valor da sessão").optional(),
    percentual_repasse: percentualRepasse("Repasse da sessão").optional(),
    pagamento_status: z.enum(["pendente", "pago"]).optional(),
    repasse_pago: z.boolean().optional(),
    repassar: z.boolean().optional(),
  })
  .refine((o) => Object.keys(o).length > 0, "Nada para alterar.");
export type AjusteSessao = z.input<typeof ajusteSessaoSchema>;

export async function ajustarFinanceiroSessao(agendamentoId: string, patch: AjusteSessao) {
  const d = validar(ajusteSessaoSchema, patch);
  garantir(await supabase.from("atendimento_financeiro").update(semIndefinidos(d)).eq("agendamento_id", agendamentoId));
}

// ---------- Repasse padrão do profissional ----------
export const configRepasseSchema = z.object({
  valor_sessao_padrao: valorReais("Valor padrão da sessão"),
  percentual_repasse_padrao: percentualRepasse("Repasse de profissional"),
});
export type ConfigRepasse = z.input<typeof configRepasseSchema>;

export async function salvarConfigRepasse(userId: string, entrada: ConfigRepasse) {
  const d = validar(configRepasseSchema, entrada);
  garantir(await supabase.from("profissional_config").upsert({ user_id: userId, ...d }));
}
