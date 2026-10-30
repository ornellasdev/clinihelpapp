import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { moduloPorId } from "./treinamento/conteudo";
import { corrigir } from "./treinamento/trilha";

const envioSchema = z.object({
  moduloId: z.string().regex(/^[a-z0-9-]{2,60}$/),
  respostas: z.array(z.number().int().min(-1).max(9)).max(30),
});

/**
 * Corrige o questionário no servidor e grava o resultado (a pessoa não consegue gravar nota pela própria conta).
 * Devolve a nota e o gabarito para mostrar as explicações.
 */
export const enviarQuestionario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.infer<typeof envioSchema>) => envioSchema.parse(input))
  .handler(async ({ data, context }) => {
    const modulo = moduloPorId(data.moduloId);
    if (!modulo) throw new Error("Tópico de treinamento não encontrado.");
    if (data.respostas.length !== modulo.questoes.length || data.respostas.some((r) => r < 0))
      throw new Error("Responda todas as perguntas antes de enviar.");

    const { data: clinicaId } = await context.supabase.rpc("minha_clinica");
    if (!clinicaId) throw new Error("Sessão sem clínica ativa. Entre novamente.");

    const r = corrigir(modulo, data.respostas);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("treinamento_resultados").insert({
      clinica_id: clinicaId as string,
      user_id: context.userId,
      modulo_id: modulo.id,
      versao: modulo.versao,
      acertos: r.acertos,
      total: r.total,
      aprovado: r.aprovado,
    });
    if (error) throw new Error("Não foi possível registrar o resultado. Tente de novo.");
    return r;
  });
