import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";

/** Endereço antigo: Cobranças agora é uma aba do Financeiro. */
export const Route = createFileRoute("/_authenticated/$clinica/cobrancas")({
  validateSearch: z.object({
    mes: z.string().regex(/^\d{4}-\d{2}$/).optional(),
    status: z.string().optional(),
  }),
  beforeLoad: ({ params, search }) => {
    throw redirect({
      to: "/$clinica/financeiro",
      params,
      search: { aba: "cobrancas", mes: search.mes, situacao: search.status },
      replace: true,
    });
  },
  head: () => ({ meta: [{ title: "Cobranças — CliniHelp" }] }),
});
