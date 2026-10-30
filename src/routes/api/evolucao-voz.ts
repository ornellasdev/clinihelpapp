import { createFileRoute } from "@tanstack/react-router";
import { tratarEvolucaoPorVoz } from "@/lib/evolucao-voz.server";

export const Route = createFileRoute("/api/evolucao-voz")({
  server: { handlers: { POST: ({ request }) => tratarEvolucaoPorVoz(request) } },
});
