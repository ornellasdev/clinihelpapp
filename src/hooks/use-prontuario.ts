import { useMutation, useQueryClient } from "@tanstack/react-query";
import { registrarAdendo, registrarEvolucao, type NovaEvolucao, type NovoAdendo } from "@/services/prontuario";

export function useRegistrarEvolucao(pacienteId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (e: NovaEvolucao) => registrarEvolucao(e),
    onSuccess: (_id, e) => {
      qc.invalidateQueries({ queryKey: ["evolucoes", pacienteId] });
      // Evolução ligada a uma sessão finaliza o atendimento no banco (cobrança, guia e repasse seguem o status).
      if (e.agendamentoId) for (const k of [["agenda"], ["financeiro"], ["guias"], ["indicadores"]]) qc.invalidateQueries({ queryKey: k });
    },
  });
}

export function useRegistrarAdendo(pacienteId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (a: NovoAdendo) => registrarAdendo(a),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["evolucoes", pacienteId, "adendos"] }),
  });
}
