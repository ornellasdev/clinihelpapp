import { useClinica } from "@/hooks/use-clinica";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Suspense, useState } from "react";
import { format } from "date-fns";
import { ArrowLeft, CalendarPlus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { agendaPacienteQuery, conveniosQuery, pacienteQuery } from "@/lib/queries";
import { useMe } from "@/hooks/use-me";
import { podeAgendar, podeEditarPaciente } from "@/lib/permissions";
import { STATUS_AGENDA, corEsp, erroAmigavel, fmtData, fmtHora, idade, iniciais } from "@/lib/ui-helpers";
import { PacienteForm } from "@/components/pacientes/PacienteForm";
import { ProntuarioTab } from "@/components/pacientes/ProntuarioTab";
import { PlanoTerapeuticoTab } from "@/components/pacientes/PlanoTerapeuticoTab";
import { FamiliaTab } from "@/components/pacientes/FamiliaTab";
import { DocumentosTab } from "@/components/pacientes/DocumentosTab";
import { AgendamentoDialog } from "@/components/agenda/AgendamentoDialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

const ABAS = ["prontuario", "plano", "cadastro", "documentos", "familia", "atendimentos"] as const;

export const Route = createFileRoute("/_authenticated/$clinica/pacientes/$id")({
  validateSearch: z.object({
    aba: z.enum(ABAS).optional(),
    agendamento: z.string().optional(),
  }),
  loader: async ({ context, params }) => {
    const [paciente] = await Promise.all([
      context.queryClient.ensureQueryData(pacienteQuery(params.id)),
      context.queryClient.ensureQueryData(conveniosQuery),
    ]);
    return paciente;
  },
  head: ({ loaderData }) => ({ meta: [{ title: `${loaderData?.nome ?? "Paciente"} — CliniHelp` }] }),
  component: PacientePage,
});

const Carregando = () => (
  <div className="flex justify-center py-12">
    <Loader2 className="size-6 animate-spin text-muted-foreground" />
  </div>
);

function PacientePage() {
  const clinica = useClinica();
  const { id } = Route.useParams();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const me = useMe();
  const qc = useQueryClient();
  const { data: p } = useSuspenseQuery(pacienteQuery(id));
  const [agendar, setAgendar] = useState(false);
  const aba = search.aba ?? "prontuario";

  return (
    <div>
      <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2">
        <Link to="/$clinica/pacientes" params={{ clinica }}>
          <ArrowLeft /> Pacientes
        </Link>
      </Button>

      <div className="mb-6 flex flex-wrap items-center gap-4 rounded-2xl border bg-card p-5">
        <div className="flex size-14 items-center justify-center rounded-full bg-secondary font-display text-xl font-semibold text-secondary-foreground">
          {iniciais(p.nome)}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-semibold md:text-2xl">{p.nome}</h1>
          <div className="mt-0.5 flex flex-wrap gap-x-3 text-sm text-muted-foreground">
            {p.data_nascimento && (
              <span>
                {idade(p.data_nascimento)} · {fmtData(p.data_nascimento)}
              </span>
            )}
            {p.diagnostico && <span>{p.diagnostico}</span>}
            {p.responsavel_nome && (
              <span>
                Resp.: {p.responsavel_nome} {p.responsavel_telefone && `· ${p.responsavel_telefone}`}
              </span>
            )}
          </div>
        </div>
        {podeAgendar(me.papeis) && (
          <Button variant="secondary" onClick={() => setAgendar(true)}>
            <CalendarPlus /> Agendar
          </Button>
        )}
      </div>

      <Tabs value={aba} onValueChange={(v) => navigate({ search: { aba: v as (typeof ABAS)[number] } })}>
        <TabsList className="mb-5 h-auto w-full justify-start overflow-x-auto bg-surface p-1 sm:w-auto">
          <TabsTrigger value="prontuario" className="px-4 py-2">Prontuário</TabsTrigger>
          <TabsTrigger value="plano" className="px-4 py-2">Plano terapêutico</TabsTrigger>
          <TabsTrigger value="cadastro" className="px-4 py-2">Cadastro</TabsTrigger>
          <TabsTrigger value="documentos" className="px-4 py-2">Documentos</TabsTrigger>
          <TabsTrigger value="familia" className="px-4 py-2">Família</TabsTrigger>
          <TabsTrigger value="atendimentos" className="px-4 py-2">Atendimentos</TabsTrigger>
        </TabsList>

        <TabsContent value="prontuario">
          <Suspense fallback={<Carregando />}>
            <ProntuarioTab pacienteId={id} agendamentoId={search.agendamento} />
          </Suspense>
        </TabsContent>
        <TabsContent value="plano">
          <Suspense fallback={<Carregando />}>
            <PlanoTerapeuticoTab pacienteId={id} />
          </Suspense>
        </TabsContent>
        <TabsContent value="cadastro">
          <PacienteForm
            key={p.updated_at}
            inicial={p}
            somenteLeitura={!podeEditarPaciente(me.papeis)}
            onSalvar={async (d) => {
              const { error } = await supabase.from("pacientes").update(d).eq("id", id);
              if (error) return void toast.error(erroAmigavel(error.message));
              toast.success("Cadastro atualizado.");
              qc.invalidateQueries({ queryKey: ["paciente", id] });
              qc.invalidateQueries({ queryKey: ["pacientes"] });
            }}
          />
        </TabsContent>
        <TabsContent value="documentos">
          <Suspense fallback={<Carregando />}>
            <DocumentosTab pacienteId={id} />
          </Suspense>
        </TabsContent>
        <TabsContent value="familia">
          <Suspense fallback={<Carregando />}>
            <FamiliaTab pacienteId={id} />
          </Suspense>
        </TabsContent>
        <TabsContent value="atendimentos">
          <Suspense fallback={<Carregando />}>
            <Atendimentos pacienteId={id} />
          </Suspense>
        </TabsContent>
      </Tabs>

      <AgendamentoDialog open={agendar} onOpenChange={setAgendar} padrao={{ data: format(new Date(), "yyyy-MM-dd"), pacienteId: id }} />
    </div>
  );
}

function Atendimentos({ pacienteId }: { pacienteId: string }) {
  const { data } = useSuspenseQuery(agendaPacienteQuery(pacienteId));
  if (!data.length) return <p className="py-8 text-center text-sm text-muted-foreground">Nenhum atendimento ainda.</p>;
  return (
    <div className="divide-y rounded-2xl border bg-card">
      {data.map((a) => (
        <div key={a.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
          <div className="w-28 font-medium">
            {fmtData(a.inicio)} <span className="text-muted-foreground">{fmtHora(a.inicio)}</span>
          </div>
          <span className={cn("rounded-full border px-2 py-0.5 text-xs", corEsp(a.especialidade?.cor))}>{a.especialidade?.nome}</span>
          <span className="flex-1 truncate text-muted-foreground">
            {a.profissional?.nome} · {a.sala?.nome}
          </span>
          <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", STATUS_AGENDA[a.status].className)}>
            {STATUS_AGENDA[a.status].label}
          </span>
        </div>
      ))}
    </div>
  );
}
