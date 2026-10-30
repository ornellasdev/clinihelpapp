import { useClinica } from "@/hooks/use-clinica";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { useCriarPaciente } from "@/hooks/use-pacientes";
import { mensagemDeErro } from "@/services/resultado";
import { conveniosQuery } from "@/lib/queries";
import { PageHeader } from "@/components/PageHeader";
import { PacienteForm } from "@/components/pacientes/PacienteForm";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/$clinica/pacientes/novo")({
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
  const clinica = useClinica();
  const navigate = useNavigate();
  const criar = useCriarPaciente();
  return (
    <div>
      <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2">
        <Link to="/$clinica/pacientes" params={{ clinica }}>
          <ArrowLeft /> Pacientes
        </Link>
      </Button>
      <PageHeader titulo="Novo paciente" descricao="Cadastro administrativo. Depois de salvar, você poderá anexar documentos; os dados clínicos são preenchidos pela equipe terapêutica." />
      <PacienteForm
        textoBotao="Cadastrar paciente"
        onSalvar={async (d) => {
          try {
            const id = await criar.mutateAsync(d);
            toast.success("Paciente cadastrado.");
            navigate({ to: "/$clinica/pacientes/$id", params: { clinica, id }, search: { aba: "documentos" } });
          } catch (e) {
            toast.error(mensagemDeErro(e));
          }
        }}
      />
    </div>
  );
}
