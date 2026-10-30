import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { enviarQuestionario } from "@/lib/treinamento.functions";

export function useEnviarQuestionario() {
  const enviar = useServerFn(enviarQuestionario);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (d: { moduloId: string; respostas: number[] }) => enviar({ data: d }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["treinamento"] });
      qc.invalidateQueries({ queryKey: ["governanca"] });
    },
  });
}
