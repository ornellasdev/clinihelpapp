import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { addDays, format, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarDays, FilePenLine, Plus, Users } from "lucide-react";
import { agendaQuery } from "@/lib/queries";
import { useMe } from "@/hooks/use-me";
import { podeAgendar, podeEditarPaciente, podeEscreverEvolucao } from "@/lib/permissions";
import { STATUS_AGENDA, barraEsp, fmtHora } from "@/lib/ui-helpers";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function hojeRange() {
  const ini = startOfDay(new Date());
  return [ini.toISOString(), addDays(ini, 1).toISOString()] as const;
}

export const Route = createFileRoute("/_authenticated/$clinica/painel")({
  loader: ({ context }) => {
    const [a, b] = hojeRange();
    return context.queryClient.ensureQueryData(agendaQuery(a, b));
  },
  head: () => ({ meta: [{ title: "Painel — CliniHelp" }] }),
  component: Painel,
});

function Painel() {
  const me = useMe();
  const [a, b] = hojeRange();
  const { data: hoje } = useSuspenseQuery(agendaQuery(a, b));
  const soProfissional = me.papeis.includes("profissional") && !podeAgendar(me.papeis);
  const lista = (soProfissional ? hoje.filter((i) => i.profissional_id === me.id) : hoje).filter((i) => i.status !== "cancelado");
  const meus = hoje.filter((i) => i.profissional_id === me.id && i.status !== "cancelado");
  const realizados = lista.filter((i) => i.status === "realizado").length;
  const primeiroNome = me.nome.split(" ")[0];
  const hora = new Date().getHours();
  const saudacao = hora < 12 ? "Bom dia" : hora < 18 ? "Boa tarde" : "Boa noite";

  return (
    <div>
      <div className="mb-6">
        <p className="text-sm text-muted-foreground">{format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })}</p>
        <h1 className="text-2xl font-semibold md:text-3xl">
          {saudacao}, {primeiroNome}
        </h1>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={soProfissional ? "Meus atendimentos hoje" : "Atendimentos hoje"} valor={lista.length} />
        <Stat label="Realizados" valor={realizados} />
        {me.papeis.includes("profissional") && !soProfissional && <Stat label="Meus atendimentos" valor={meus.length} />}
        <div className="col-span-2 flex flex-wrap items-center gap-2 lg:col-span-1">
          {podeAgendar(me.papeis) && (
            <Button asChild className="flex-1">
              <Link to="/agenda">
                <CalendarDays /> Agenda
              </Link>
            </Button>
          )}
          {podeEditarPaciente(me.papeis) && (
            <Button asChild variant="secondary" className="flex-1">
              <Link to="/pacientes/novo">
                <Plus /> Paciente
              </Link>
            </Button>
          )}
          {!podeAgendar(me.papeis) && (
            <Button asChild variant="secondary" className="flex-1">
              <Link to="/pacientes">
                <Users /> Pacientes
              </Link>
            </Button>
          )}
        </div>
      </div>

      <section className="rounded-2xl border bg-card">
        <div className="flex items-center justify-between border-b p-4">
          <h2 className="font-semibold">{soProfissional ? "Minha agenda de hoje" : "Agenda de hoje"}</h2>
          <Link to="/agenda" className="text-sm font-medium text-primary">
            Ver agenda
          </Link>
        </div>
        {lista.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">Nenhum atendimento para hoje.</p>
        ) : (
          <div className="divide-y">
            {lista.map((i) => (
              <div key={i.id} className={cn("flex items-center gap-3 border-l-4 p-3", barraEsp(i.especialidade?.cor))}>
                <div className="w-12 shrink-0 font-display font-semibold">{fmtHora(i.inicio)}</div>
                <div className="min-w-0 flex-1">
                  <Link to="/pacientes/$id" params={{ id: i.paciente_id }} className="block truncate font-medium hover:underline">
                    {i.paciente?.nome}
                  </Link>
                  <div className="truncate text-xs text-muted-foreground">
                    {i.especialidade?.nome} · {i.profissional?.nome} · {i.sala?.nome}
                  </div>
                </div>
                <span className={cn("hidden rounded-full px-2 py-0.5 text-xs font-medium sm:inline", STATUS_AGENDA[i.status].className)}>
                  {STATUS_AGENDA[i.status].label}
                </span>
                {podeEscreverEvolucao(me.especialidades, i.especialidade_id) && i.profissional_id === me.id && (
                  <Button asChild size="sm" variant="outline">
                    <Link to="/pacientes/$id" params={{ id: i.paciente_id }} search={{ aba: "prontuario", agendamento: i.id }}>
                      <FilePenLine /> <span className="hidden sm:inline">Evoluir</span>
                    </Link>
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({ label, valor }: { label: string; valor: number }) {
  return (
    <div className="rounded-2xl border bg-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 font-display text-3xl font-semibold">{valor}</div>
    </div>
  );
}
