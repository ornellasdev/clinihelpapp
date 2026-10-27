import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { erroAmigavel } from "@/lib/ui-helpers";
import { conveniosQuery } from "@/lib/queries";
import { PageHeader } from "@/components/PageHeader";
import { PacienteForm } from "@/components/pacientes/PacienteForm";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/_clinic/pacientes/novo")({
  loader: ({ context }) => context.queryClient.ensureQueryData(conveniosQuery),
  head: () => ({ meta: [{ title: "Novo paciente — CliniHelp" }] }),
  component: NovoPaciente,
  errorComponent: ({ error }) => (
    <div role="alert" className="rounded-2xl border bg-card p-6 text-sm">
      <p className="font-medium">Não foi possível abrir o cadastro de paciente.</p>
      <p className="mt-1 text-muted-foreground">{error instanceof Error ? error.message : String(error)}</p>
    </div>
  ),
});

function NovoPaciente() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  return (
    <div>
      <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2">
        <Link to="/pacientes">
          <ArrowLeft /> Pacientes
        </Link>
      </Button>
      <PageHeader titulo="Novo paciente" descricao="Depois de salvar, você poderá anexar documentos." />
      <PacienteForm
        textoBotao="Cadastrar paciente"
        onSalvar={async (d) => {
          const { data, error } = await supabase.from("pacientes").insert(d).select("id").single();
          if (error) {
            toast.error(erroAmigavel(error.message));
            return;
          }
          toast.success("Paciente cadastrado.");
          qc.invalidateQueries({ queryKey: ["pacientes"] });
          navigate({ to: "/pacientes/$id", params: { id: data.id }, search: { aba: "documentos" } });
        }}
      />
    </div>
  );
}
