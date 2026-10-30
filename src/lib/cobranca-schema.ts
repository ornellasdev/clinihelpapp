// Validação da nova cobrança — a mesma no formulário e no servidor (cobrancas.functions.ts).
import { z } from "zod";
import { VALOR_MINIMO_COBRANCA } from "./cobrancas";
import { hojeEmSaoPaulo, valorReais, vencimentoValido } from "./validacao";

export const novaCobrancaSchema = z.object({
  pacienteId: z.string().uuid("Escolha o paciente."),
  sessoes: z.array(z.string().uuid()).max(200, "Escolha no máximo 200 sessões por cobrança."),
  valor: valorReais("Valor da cobrança", VALOR_MINIMO_COBRANCA),
  vencimento: z.string().refine((s) => vencimentoValido(s, hojeEmSaoPaulo()), "O vencimento precisa ser de hoje até 1 ano à frente."),
  descricao: z.string().trim().min(3, "Escreva a descrição da cobrança.").max(500, "Descrição muito longa (máx. 500 caracteres)."),
  forma: z.enum(["pix", "boleto", "cartao", "todas"], "Escolha a forma de pagamento."),
  /** Cobrança da avaliação inicial do paciente novo (libera o formulário da família quando paga). */
  avaliacaoInicial: z.boolean().optional(),
});
export type NovaCobranca = z.input<typeof novaCobrancaSchema>;
