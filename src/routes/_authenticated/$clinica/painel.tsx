import { useClinica } from "@/hooks/use-clinica";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { addDays, format, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { BellRing, CalendarDays, FilePenLine, Loader2, Play, Plus, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { agendaQuery, type AgendaItem } from "@/lib/queries";
import { useMe } from "@/hooks/use-me";
import { podeAgendar, podeEditarPaciente, podeEscreverEvolucao, podeGerirFinanceiro } from "@/lib/permissions";
import { AvaliacoesPainel } from "@/components/avaliacao/AvaliacoesPainel";
import { NA_FILA, ehPrevisto, iniciaAoAbrirEvolucao, ordemFila } from "@/lib/agenda-status";
import { STATUS_AGENDA, barraEsp, erroAmigavel, fmtHora } from "@/lib/ui-helpers";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function hojeRange() {
  const ini = startOfDay(new Date());
  return [ini.toISOString(), addDays(ini, 1).toISOString()] as const;
}

/** A fila do terapeuta se atualiza sozinha: quando a recepção marca a chegada, a criança aparece aqui. */
const ATUALIZA_FILA_MS = 20_000;

export const Route = createFileRoute("/_authenticated/$clinica/painel")({
  loader: ({ context }) => {
    const [a, b] = hojeRange();
    return context.queryClient.ensureQueryData(agendaQuery(a, b));
  },
  head: () => ({ meta: [{ title: "Painel — CliniHelp" }] }),
  component: Painel,
});

function Painel() {
  const clinica = useClinica();
  const me = useMe();
  const [a, b] = hojeRange();
  const { data: hoje } = useSuspenseQuery({ ...agendaQuery(a, b), refetchInterval: ATUALIZA_FILA_MS });
  const ehProfissional = me.papeis.includes("profissional");
  const soProfissional = ehProfissional && !podeAgendar(me.papeis);
  const lista = hoje.filter((i) => i.status !== "cancelado");
  const meus = lista.filter((i) => i.profissional_id === me.id).sort(ordemFila);
  const base = soProfissional ? meus : lista;
  const finalizados = base.filter((i) => i.status === "finalizado").length;
  const naFila = base.filter((i) => NA_FILA.includes(i.status)).length;
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
        <Stat label={soProfissional ? "Meus atendimentos hoje" : "Atendimentos hoje"} valor={base.length} />
        <Stat label={soProfissional ? "Aguardando / em atendimento" : "Na clínica agora"} valor={naFila} destaque={naFila > 0} />
        <Stat label="Finalizados" valor={finalizados} />
        <div className="col-span-2 flex flex-wrap items-center gap-2 lg:col-span-1">
          {podeAgendar(me.papeis) && (
            <Button asChild className="flex-1">
              <Link to="/$clinica/agenda" params={{ clinica }}>
                <CalendarDays /> Agenda
              </Link>
            </Button>
          )}
          {podeEditarPaciente(me.papeis) && (
            <Button asChild variant="secondary" className="flex-1">
              <Link to="/$clinica/pacientes/novo" params={{ clinica }}>
                <Plus /> Paciente
              </Link>
            </Button>
          )}
          {!podeAgendar(me.papeis) && (
            <Button asChild variant="secondary" className="flex-1">
              <Link to="/$clinica/pacientes" params={{ clinica }}>
                <Users /> Pacientes
              </Link>
            </Button>
          )}
        </div>
      </div>

      {(podeAgendar(me.papeis) || podeGerirFinanceiro(me.papeis)) && <AvaliacoesPainel />}

      {ehProfissional && <MeusAtendimentos itens={meus} />}

      {!soProfissional && (
        <section className="rounded-2xl border bg-card">
          <div className="flex items-center justify-between border-b p-4">
            <h2 className="font-semibold">Agenda de hoje</h2>
            <Link to="/$clinica/agenda" params={{ clinica }} className="text-sm font-medium text-primary">
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
                    <Link to="/$clinica/pacientes/$id" params={{ clinica, id: i.paciente_id }} className="block truncate font-medium hover:underline">
                      {i.paciente?.nome}
                    </Link>
                    <div className="truncate text-xs text-muted-foreground">
                      {i.especialidade?.nome} · {i.profissional?.nome} · {i.sala?.nome}
                    </div>
                  </div>
                  <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", STATUS_AGENDA[i.status].className)}>
                    {STATUS_AGENDA[i.status].curto}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

/** "Meus atendimentos de hoje": quem está aguardando ou em atendimento fica no topo, com botão Iniciar / Evoluir. */
function MeusAtendimentos({ itens }: { itens: AgendaItem[] }) {
  const clinica = useClinica();
  const me = useMe();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [abrindo, setAbrindo] = useState<string | null>(null);
  const fila = itens.filter((i) => NA_FILA.includes(i.status));

  async function iniciar(i: AgendaItem) {
    setAbrindo(i.id);
    if (iniciaAoAbrirEvolucao(i.status)) {
      const { error } = await supabase.from("agendamentos").update({ status: "em_atendimento" }).eq("id", i.id);
      if (error) {
        setAbrindo(null);
        return void toast.error(erroAmigavel(error.message));
      }
      qc.invalidateQueries({ queryKey: ["agenda"] });
    }
    navigate({ to: "/$clinica/pacientes/$id", params: { clinica, id: i.paciente_id }, search: { aba: "prontuario", agendamento: i.id } });
  }

  return (
    <section className="mb-6 rounded-2xl border bg-card">
      <div className="flex flex-wrap items-center gap-2 border-b p-4">
        <h2 className="font-semibold">Meus atendimentos de hoje</h2>
        {fila.length > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-status-aguardando/25 px-2 py-0.5 text-xs font-medium text-warning-foreground">
            <BellRing className="size-3" /> {fila.length} {fila.length === 1 ? "pronto para atender" : "prontos para atender"}
          </span>
        )}
      </div>
      {itens.length === 0 ? (
        <p className="p-8 text-center text-sm text-muted-foreground">Nenhum atendimento seu para hoje.</p>
      ) : (
        <div className="divide-y">
          {itens.map((i) => {
            const destaque = NA_FILA.includes(i.status);
            const pode = podeEscreverEvolucao(me.especialidades, i.especialidade_id);
            const aberto = ehPrevisto(i.status);
            return (
              <div
                key={i.id}
                className={cn("flex items-center gap-3 border-l-4 p-3", barraEsp(i.especialidade?.cor), destaque && STATUS_AGENDA[i.status].bloco)}
              >
                <div className="w-12 shrink-0 font-display font-semibold">{fmtHora(i.inicio)}</div>
                <div className="min-w-0 flex-1">
                  <Link to="/$clinica/pacientes/$id" params={{ clinica, id: i.paciente_id }} className="block truncate font-medium hover:underline">
                    {i.paciente?.nome}
                  </Link>
                  <div className="truncate text-xs text-muted-foreground">
                    {i.especialidade?.nome} · {i.sala?.nome}
                    {i.status === "aguardando" && i.chegada_em && ` · chegou ${fmtHora(i.chegada_em)}`}
                  </div>
                </div>
                <span className={cn("hidden rounded-full px-2 py-0.5 text-xs font-medium sm:inline", STATUS_AGENDA[i.status].className)}>
                  {STATUS_AGENDA[i.status].curto}
                </span>
                {pode && aberto && (
                  <Button size="sm" variant={destaque ? "default" : "outline"} onClick={() => iniciar(i)} disabled={abrindo === i.id}>
                    {abrindo === i.id ? <Loader2 className="animate-spin" /> : i.status === "em_atendimento" ? <FilePenLine /> : <Play />}
                    <span className={cn(!destaque && "hidden sm:inline")}>{i.status === "em_atendimento" ? "Evoluir" : "Iniciar / Evoluir"}</span>
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function Stat({ label, valor, destaque }: { label: string; valor: number; destaque?: boolean }) {
  return (
    <div className={cn("rounded-2xl border bg-card p-4", destaque && "border-status-aguardando/60 bg-status-aguardando/10")}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 font-display text-3xl font-semibold">{valor}</div>
    </div>
  );
}
