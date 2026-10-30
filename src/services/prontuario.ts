// Domínio Prontuário: evolução registrada é imutável (o banco bloqueia); correções e complementos são adendos.
import { queryOptions } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { dataPassadaValida, textoOpcional } from "@/lib/validacao";
import { garantir, validar } from "./resultado";

export const evolucaoSchema = z.object({
  pacienteId: z.string().uuid(),
  especialidadeId: z.string().uuid("Escolha a especialidade."),
  data: z.string().refine((s) => dataPassadaValida(s), "Data do atendimento inválida ou no futuro."),
  conteudo: z
    .string()
    .trim()
    .min(10, "Escreva a evolução (pelo menos 10 caracteres).")
    .max(20000, "A evolução passou de 20.000 caracteres."),
  agendamentoId: z.string().uuid().nullable(),
  metas: z
    .array(z.object({ meta_id: z.string().uuid(), nivel: z.number().int().min(1).max(5) }))
    .max(50),
});
export type NovaEvolucao = z.input<typeof evolucaoSchema>;

/** Grava a evolução e o progresso das metas numa única operação; devolve o id. */
export async function registrarEvolucao(entrada: NovaEvolucao): Promise<string> {
  const d = validar(evolucaoSchema, entrada);
  return garantir(
    await supabase.rpc("registrar_evolucao", {
      _paciente: d.pacienteId,
      _especialidade: d.especialidadeId,
      _data: d.data,
      _conteudo: d.conteudo,
      ...(d.agendamentoId ? { _agendamento: d.agendamentoId } : {}),
      _metas: d.metas,
    }),
  );
}

export const MOTIVOS_ADENDO = ["Correção de informação", "Complemento", "Erro de digitação", "Informação recebida depois"] as const;

export const adendoSchema = z.object({
  evolucaoId: z.string().uuid(),
  pacienteId: z.string().uuid(),
  especialidadeId: z.string().uuid(),
  motivo: textoOpcional(300),
  conteudo: z.string().trim().min(5, "Escreva o adendo.").max(20000, "O adendo passou de 20.000 caracteres."),
});
export type NovoAdendo = z.input<typeof adendoSchema>;

export async function registrarAdendo(entrada: NovoAdendo): Promise<void> {
  const d = validar(adendoSchema, entrada);
  garantir(
    await supabase.from("evolucao_adendos").insert({
      evolucao_id: d.evolucaoId,
      paciente_id: d.pacienteId,
      especialidade_id: d.especialidadeId,
      motivo: d.motivo,
      conteudo: d.conteudo,
    }),
  );
}

/** Adendos do paciente (o banco só devolve os das especialidades que a pessoa pode ver). */
export const adendosQuery = (pacienteId: string) =>
  queryOptions({
    queryKey: ["evolucoes", pacienteId, "adendos"],
    queryFn: async () =>
      garantir(
        await supabase
          .from("evolucao_adendos")
          .select("id, evolucao_id, motivo, conteudo, profissional_nome, profissional_registro, created_at")
          .eq("paciente_id", pacienteId)
          .order("created_at"),
      ),
  });
export type Adendo = Awaited<ReturnType<NonNullable<ReturnType<typeof adendosQuery>["queryFn"]>>>[number];

export function agruparAdendos(adendos: readonly Adendo[]): Map<string, Adendo[]> {
  const m = new Map<string, Adendo[]>();
  for (const a of adendos) m.set(a.evolucao_id, [...(m.get(a.evolucao_id) ?? []), a]);
  return m;
}
