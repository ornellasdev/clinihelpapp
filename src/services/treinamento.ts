// Domínio Treinamento (CliniHelp LMS): resultados dos questionários. O banco só devolve os próprios (ou todos, para a gestão).
import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ResultadoTreinamento } from "@/lib/treinamento/trilha";
import { garantir } from "./resultado";

const CAMPOS = "user_id, modulo_id, versao, acertos, total, aprovado, created_at";

export const meusResultadosQuery = (userId: string) =>
  queryOptions({
    queryKey: ["treinamento", "meus", userId],
    queryFn: async (): Promise<ResultadoTreinamento[]> => {
      const { data, error } = await supabase
        .from("treinamento_resultados")
        .select(CAMPOS)
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      garantir({ data, error });
      return data ?? [];
    },
  });

/** Resultados de toda a clínica (só a gestão recebe linhas de outras pessoas). */
export const resultadosEquipeQuery = queryOptions({
  queryKey: ["treinamento", "equipe"],
  queryFn: async (): Promise<ResultadoTreinamento[]> => {
    const { data, error } = await supabase.from("treinamento_resultados").select(CAMPOS).order("created_at", { ascending: false }).limit(5000);
    garantir({ data, error });
    return data ?? [];
  },
});
