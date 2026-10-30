// Domínio Guias de convênio: validação dos 3 códigos obrigatórios e das quantidades antes de gravar.
import { z } from "zod";
import { codigoOperadoraValido, normalizarTuss, tussValido } from "@/lib/validacao";

export const codigosGuiaSchema = z.object({
  codigo_tuss: z
    .string()
    .trim()
    .min(1, "Informe o código TUSS.")
    .refine(tussValido, "Código TUSS precisa ter 8 dígitos (ex.: 50000470).")
    .transform(normalizarTuss),
  codigo_guia: z
    .string()
    .trim()
    .min(1, "Informe o número da guia.")
    .refine(codigoOperadoraValido, "Número da guia: use só letras, números, ponto, traço ou barra (até 60)."),
  codigo_faturamento: z
    .string()
    .trim()
    .min(1, "Informe o código de faturamento.")
    .refine(codigoOperadoraValido, "Código de faturamento: use só letras, números, ponto, traço ou barra (até 60)."),
  sessoes_solicitadas: z.number().int("Sessões solicitadas: número inteiro.").min(1, "Informe quantas sessões foram solicitadas.").max(999),
  sessoes_autorizadas: z.number().int().min(0).max(999, "Quantidade autorizada inválida.").nullable(),
});
