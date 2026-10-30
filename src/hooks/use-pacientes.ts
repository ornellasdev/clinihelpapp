import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  atualizarPaciente,
  criarPaciente,
  salvarDadosClinicos,
  type CadastroPaciente,
  type DadosClinicos,
} from "@/services/pacientes";

export function useCriarPaciente() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dados: CadastroPaciente) => criarPaciente(dados),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pacientes"] }),
  });
}

export function useAtualizarPaciente(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dados: CadastroPaciente) => atualizarPaciente(id, dados),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["paciente", id] });
      qc.invalidateQueries({ queryKey: ["pacientes"] });
    },
  });
}

export function useSalvarDadosClinicos(pacienteId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dados: DadosClinicos) => salvarDadosClinicos(pacienteId, dados),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dados_clinicos", pacienteId] }),
  });
}
