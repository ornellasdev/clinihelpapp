import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BellRing, ClipboardList } from "lucide-react";
import { avaliacoesAbertasQuery } from "@/lib/queries";
import { useClinica } from "@/hooks/use-clinica";
import { STATUS_AVALIACAO, type StatusAvaliacao } from "@/lib/avaliacao-inicial";
import { fmtData } from "@/lib/ui-helpers";
import { cn } from "@/lib/utils";

/**
 * Aviso do Painel para recepção, gestão e financeiro: formulários preenchidos (pode agendar a 1ª consulta)
 * e avaliações ainda esperando pagamento ou formulário.
 */
export function AvaliacoesPainel() {
  const clinica = useClinica();
  const { data = [] } = useQuery({ ...avaliacoesAbertasQuery, refetchInterval: 60_000 });
  const lista = data
    .filter((a) => a.paciente?.ativo)
    .filter((a) => a.status !== "concluida" || !(a.paciente?.agendamentos?.[0]?.count ?? 0));
  if (!lista.length) return null;
  const prontos = lista.filter((a) => a.status === "concluida");
  const ordem: StatusAvaliacao[] = ["concluida", "aguardando_formulario", "aguardando_pagamento"];
  const ordenada = [...lista].sort((a, b) => ordem.indexOf(a.status as StatusAvaliacao) - ordem.indexOf(b.status as StatusAvaliacao));

  return (
    <section className="mb-6 rounded-2xl border bg-card">
      <div className="flex flex-wrap items-center gap-2 border-b p-4">
        <ClipboardList className="size-4 text-primary" />
        <h2 className="font-semibold">Avaliações iniciais</h2>
        {prontos.length > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-xs font-medium text-success">
            <BellRing className="size-3" /> {prontos.length} {prontos.length === 1 ? "formulário preenchido — pode agendar" : "formulários preenchidos — podem agendar"}
          </span>
        )}
      </div>
      <div className="divide-y">
        {ordenada.slice(0, 12).map((a) => {
          const st = STATUS_AVALIACAO[a.status as StatusAvaliacao];
          return (
            <div key={a.paciente_id} className="flex items-center gap-3 p-3 text-sm">
              <div className="min-w-0 flex-1">
                <Link to="/$clinica/pacientes/$id" params={{ clinica, id: a.paciente_id }} className="block truncate font-medium hover:underline">
                  {a.paciente?.nome}
                </Link>
                <div className="truncate text-xs text-muted-foreground">
                  {a.status === "concluida" && a.preenchido_em
                    ? `Formulário enviado em ${fmtData(a.preenchido_em, "dd/MM 'às' HH:mm")} · pagamento confirmado`
                    : a.status === "aguardando_formulario" && a.formulario_liberado_em
                      ? `Formulário liberado em ${fmtData(a.formulario_liberado_em, "dd/MM")}`
                      : `Cadastrado em ${fmtData(a.created_at, "dd/MM")}`}
                </div>
              </div>
              <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-xs font-medium", st.className)}>{st.label}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
