// Domínio Governança: painel de Segurança, Banco e Auditoria (só gestão; o banco recusa os demais perfis).
import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { PainelGovernanca } from "@/lib/conformidade";
import { garantir } from "./resultado";

export const painelGovernancaQuery = queryOptions({
  queryKey: ["governanca"],
  staleTime: 30_000,
  queryFn: async () => {
    const { data, error } = await supabase.rpc("painel_governanca");
    garantir({ data, error });
    return data as unknown as PainelGovernanca;
  },
});
