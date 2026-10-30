import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";

/** Endereço antigo: a Auditoria agora é a aba "Trilha de auditoria" de Segurança e auditoria. */
export const Route = createFileRoute("/_authenticated/$clinica/auditoria")({
  validateSearch: z.object({
    de: z.string().optional(),
    ate: z.string().optional(),
    usuario: z.string().optional(),
    area: z.string().optional(),
    acao: z.string().optional(),
  }),
  beforeLoad: ({ params, search }) => {
    throw redirect({ to: "/$clinica/seguranca/auditoria", params, search, replace: true });
  },
  head: () => ({ meta: [{ title: "Auditoria — CliniHelp" }] }),
});
