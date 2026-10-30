import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ajustarFinanceiroSessao,
  atualizarConvenio,
  criarConvenio,
  definirValorConvenio,
  removerConvenio,
  type AjusteSessao,
  type NovoConvenio,
} from "@/services/financeiro";

/** Tabela de convênios: todas as alterações recarregam nomes e valores. */
export function useConvenios() {
  const qc = useQueryClient();
  const recarregar = () => qc.invalidateQueries({ queryKey: ["convenios"] });
  return {
    criar: useMutation({ mutationFn: (c: NovoConvenio) => criarConvenio(c), onSettled: recarregar }),
    atualizar: useMutation({
      mutationFn: ({ id, patch }: { id: string; patch: Parameters<typeof atualizarConvenio>[1] }) => atualizarConvenio(id, patch),
      onSettled: recarregar,
    }),
    definirValor: useMutation({
      mutationFn: ({ id, valor }: { id: string; valor: string | number }) => definirValorConvenio(id, valor),
      onSettled: recarregar,
    }),
    remover: useMutation({ mutationFn: (id: string) => removerConvenio(id), onSettled: recarregar }),
  };
}

export function useAjustarSessao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: AjusteSessao }) => ajustarFinanceiroSessao(id, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["financeiro"] });
      qc.invalidateQueries({ queryKey: ["indicadores"] });
    },
  });
}
