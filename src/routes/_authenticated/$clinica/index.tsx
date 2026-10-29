import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/$clinica/")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/$clinica/painel", params });
  },
});
