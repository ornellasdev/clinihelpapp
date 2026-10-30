import { useClinica } from "@/hooks/use-clinica";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { Suspense, useState } from "react";
import { format } from "date-fns";
import { ArrowLeft, CalendarPlus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { agendaPacienteQuery, avaliacaoInicialQuery, conveniosQuery, pacienteQuery } from "@/lib/queries";
import { bloqueiaAgendamento, STATUS_AVALIACAO, type StatusAvaliacao } from "@/lib/avaliacao-inicial";
import { AvaliacaoInicialCard } from "@/components/avaliacao/AvaliacaoInicialCard";
import { AnamneseTab } from "@/components/avaliacao/AnamneseTab";
import { useMe } from "@/hooks/use-me";
import { podeAgendar, podeEditarPaciente, podeVerDadosClinicos } from "@/lib/permissions";
import { dadosClinicosQuery } from "@/services/pacientes";
import { mensagemDeErro } from "@/services/resultado";
import { useAtualizarPaciente } from "@/hooks/use-pacientes";
import { ClipeAtestado } from "@/components/agenda/AnexoAtestado";
import { STATUS_AGENDA, corEsp, fmtData, fmtHora, idade, iniciais } from "@/lib/ui-helpers";
import { PacienteForm } from "@/components/pacientes/PacienteForm";
import { DadosClinicosCard } from "@/components/pacientes/DadosClinicosCard";
import { ConsentimentoLgpd } from "@/components/pacientes/ConsentimentoLgpd";
import { ProntuarioTab } from "@/components/pacientes/ProntuarioTab";
import { PlanoTerapeuticoTab } from "@/components/pacientes/PlanoTerapeuticoTab";
import { FamiliaTab } from "@/components/pacientes/FamiliaTab";
import { DocumentosTab } from "@/components/pacientes/DocumentosTab";
import { AgendamentoDialog } from "@/components/agenda/AgendamentoDialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

const ABAS = ["prontuario", "plano", "anamnese", "cadastro", "documentos", "familia", "atendimentos"] as const;

export const Route = createFileRoute("/_authenticated/$clinica/pacientes/$id")({
  validateSearch: z.object({
    aba: z.enum(ABAS).optional(),
    agendamento: z.string().optional(),
  }),
  loader: async ({ context, params }) => {
    const [paciente] = await Promise.all([
      context.queryClient.ensureQueryData(pacienteQuery(params.id)),
      context.queryClient.ensureQueryData(conveniosQuery),
      context.queryClient.ensureQueryData(avaliacaoInicialQuery(params.id)),
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
  const { data: p } = useSuspenseQuery(pacienteQuery(id));
  const veClinico = podeVerDadosClinicos(me.papeis, me.especialidades);
  const { data: clinico } = useQuery({ ...dadosClinicosQuery(id), enabled: veClinico });
  const atualizar = useAtualizarPaciente(id);
  const { data: avaliacao } = useSuspenseQuery(avaliacaoInicialQuery(id));
  const bloqueado = bloqueiaAgendamento(avaliacao?.status as StatusAvaliacao | undefined);
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
            {clinico?.diagnostico && <span>{clinico.diagnostico}</span>}
            {p.responsavel_nome && (
              <span>
                Resp.: {p.responsavel_nome} {p.responsavel_telefone && `· ${p.responsavel_telefone}`}
              </span>
            )}
          </div>
        </div>
        {podeAgendar(me.papeis) && (
          <Button
            variant="secondary"
            onClick={() => setAgendar(true)}
            disabled={bloqueado}
            title={bloqueado ? STATUS_AVALIACAO[avaliacao!.status as StatusAvaliacao].descricao : undefined}
          >
            <CalendarPlus /> Agendar
          </Button>
        )}
      </div>

      <AvaliacaoInicialCard paciente={p} onVerFormulario={() => navigate({ search: { aba: "anamnese" } })} />

      <Tabs value={aba} onValueChange={(v) => navigate({ search: { aba: v as (typeof ABAS)[number] } })}>
        <TabsList className="mb-5 h-auto w-full justify-start overflow-x-auto bg-surface p-1 sm:w-auto">
          <TabsTrigger value="prontuario" className="px-4 py-2">Prontuário</TabsTrigger>
          <TabsTrigger value="plano" className="px-4 py-2">Plano terapêutico</TabsTrigger>
          {veClinico && avaliacao?.status === "concluida" && <TabsTrigger value="anamnese" className="px-4 py-2">Avaliação inicial</TabsTrigger>}
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
        {veClinico && (
          <TabsContent value="anamnese">
            <Suspense fallback={<Carregando />}>
              <AnamneseTab pacienteId={id} pacienteNome={p.nome} />
            </Suspense>
          </TabsContent>
        )}
        <TabsContent value="cadastro" className="space-y-5">
          <ConsentimentoLgpd paciente={p} />
          {veClinico && (
            <Suspense fallback={<Carregando />}>
              <DadosClinicosCard pacienteId={id} />
            </Suspense>
          )}
          <PacienteForm
            key={p.updated_at}
            inicial={p}
            somenteLeitura={!podeEditarPaciente(me.papeis)}
            onSalvar={async (d) => {
              try {
                await atualizar.mutateAsync(d);
                toast.success("Cadastro atualizado.");
              } catch (e) {
                toast.error(mensagemDeErro(e));
              }
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
          {a.reposicao_pendente && <span className="rounded-full bg-warning/25 px-2 py-0.5 text-xs font-medium text-warning-foreground">Reposição pendente</span>}
          <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", STATUS_AGENDA[a.status].className)}>
            {STATUS_AGENDA[a.status].label}
          </span>
          {a.documentos?.length ? <ClipeAtestado docs={a.documentos} /> : null}
          {a.falta_motivo && <p className="w-full pl-0 text-xs text-muted-foreground sm:pl-[7.75rem]">{a.falta_motivo}</p>}
        </div>
      ))}
    </div>
  );
}
