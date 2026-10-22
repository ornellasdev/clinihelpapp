import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Phone, Plus, Search } from "lucide-react";
import { pacientesQuery } from "@/lib/queries";
import { useMe } from "@/hooks/use-me";
import { podeEditarPaciente } from "@/lib/permissions";
import { idade, iniciais } from "@/lib/ui-helpers";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/_clinic/pacientes/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(pacientesQuery("")),
  head: () => ({ meta: [{ title: "Pacientes — CliniHelp" }] }),
  component: PacientesPage,
});

function PacientesPage() {
  const me = useMe();
  const navigate = useNavigate();
  const [busca, setBusca] = useState("");
  const [termo, setTermo] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setTermo(busca), 250);
    return () => clearTimeout(t);
  }, [busca]);
  const { data: pacientes, isFetching } = useQuery({ ...pacientesQuery(termo), placeholderData: (prev) => prev });

  return (
    <div>
      <PageHeader
        titulo="Pacientes"
        descricao={pacientes ? `${pacientes.length} cadastrado(s)` : undefined}
        acoes={
          podeEditarPaciente(me.papeis) && (
            <Button asChild>
              <Link to="/pacientes/novo">
                <Plus /> Novo paciente
              </Link>
            </Button>
          )
        }
      />
      <div className="relative mb-5">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="h-11 pl-9" placeholder="Buscar por nome..." value={busca} onChange={(e) => setBusca(e.target.value)} />
      </div>

      {!pacientes ? (
        <Skeleton className="h-40 w-full" />
      ) : pacientes.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          {termo ? "Nenhum paciente encontrado." : "Nenhum paciente cadastrado ainda."}
        </div>
      ) : (
        <div className={`grid gap-3 sm:grid-cols-2 xl:grid-cols-3 ${isFetching ? "opacity-70" : ""}`}>
          {pacientes.map((p) => (
            <button
              key={p.id}
              onClick={() => navigate({ to: "/pacientes/$id", params: { id: p.id } })}
              className="flex items-start gap-3 rounded-2xl border bg-card p-4 text-left transition hover:border-primary/40 hover:shadow-sm"
            >
              <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-secondary font-display font-semibold text-secondary-foreground">
                {iniciais(p.nome)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-semibold">{p.nome}</span>
                  {!p.ativo && <span className="rounded bg-muted px-1.5 text-[10px] uppercase text-muted-foreground">inativo</span>}
                </div>
                <div className="text-sm text-muted-foreground">
                  {[idade(p.data_nascimento), p.diagnostico].filter(Boolean).join(" · ") || "—"}
                </div>
                {p.responsavel_nome && (
                  <div className="mt-1.5 flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                    <Phone className="size-3" /> {p.responsavel_nome}
                    {p.responsavel_telefone && ` · ${p.responsavel_telefone}`}
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
