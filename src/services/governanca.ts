// Domínio Governança: painel de Segurança, Banco e Auditoria (só gestão; o banco recusa os demais perfis).
import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { PainelGovernanca } from "@/lib/conformidade";
import { MODULOS_ESSENCIAIS } from "@/lib/treinamento/conteudo";
import { garantir } from "./resultado";

export const painelGovernancaQuery = queryOptions({
  queryKey: ["governanca"],
  staleTime: 30_000,
  queryFn: async (): Promise<PainelGovernanca> => {
    const [painel, treino] = await Promise.all([
      supabase.rpc("painel_governanca"),
      supabase.from("treinamento_resultados").select("user_id, modulo_id").eq("aprovado", true).in("modulo_id", MODULOS_ESSENCIAIS),
    ]);
    garantir(painel);
    garantir(treino);
    const p = painel.data as unknown as Omit<PainelGovernanca, "treinamento">;
    const ativos = p.equipe.contas.filter((c) => c.ativo);
    const aprovados = new Map<string, Set<string>>();
    for (const r of treino.data ?? []) aprovados.set(r.user_id, (aprovados.get(r.user_id) ?? new Set()).add(r.modulo_id));
    const concluiram = ativos.filter((c) => MODULOS_ESSENCIAIS.every((m) => aprovados.get(c.id)?.has(m))).length;
    return { ...p, treinamento: { ativos: ativos.length, concluiram } };
  },
});
