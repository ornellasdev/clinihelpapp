import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { addDays, differenceInMinutes, format, parseISO, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { z } from "zod";
import { agendaQuery, equipeQuery, especialidadesQuery, salasQuery, type AgendaItem } from "@/lib/queries";
import { useMe } from "@/hooks/use-me";
import { podeAgendar } from "@/lib/permissions";
import { STATUS_AGENDA, barraEsp, corEsp, fmtHora } from "@/lib/ui-helpers";
import { PageHeader } from "@/components/PageHeader";
import { AgendamentoDialog, type NovoAgendamentoPadrao } from "@/components/agenda/AgendamentoDialog";
import { AgendamentoDetalhe } from "@/components/agenda/AgendamentoDetalhe";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const hoje = () => format(new Date(), "yyyy-MM-dd");

const searchSchema = z.object({
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  prof: z.string().optional(),
});

function intervalo(data: string) {
  const ini = startOfDay(parseISO(data));
  return [ini.toISOString(), addDays(ini, 1).toISOString()] as const;
}

export const Route = createFileRoute("/_authenticated/$clinica/agenda")({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({ data: search.data ?? hoje() }),
  loader: ({ context, deps }) => {
    const [a, b] = intervalo(deps.data);
    return Promise.all([
      context.queryClient.ensureQueryData(agendaQuery(a, b)),
      context.queryClient.ensureQueryData(salasQuery),
      context.queryClient.ensureQueryData(equipeQuery),
      context.queryClient.ensureQueryData(especialidadesQuery),
    ]);
  },
  head: () => ({ meta: [{ title: "Agenda — CliniHelp" }] }),
  component: AgendaPage,
});

const HORA_INI = 7;
const HORA_FIM = 20;
const PX_HORA = 72;

function AgendaPage() {
  const search = Route.useSearch();
  const data = search.data ?? hoje();
  const navigate = useNavigate({ from: Route.fullPath });
  const me = useMe();
  const [a, b] = intervalo(data);
  const { data: itens } = useSuspenseQuery(agendaQuery(a, b));
  const { data: salas } = useSuspenseQuery(salasQuery);
  const { data: equipe } = useSuspenseQuery(equipeQuery);
  const [novo, setNovo] = useState<NovoAgendamentoPadrao | null>(null);
  const [detalhe, setDetalhe] = useState<AgendaItem | null>(null);

  const profissionais = equipe.filter((m) => m.papeis.includes("profissional"));
  const filtrados = useMemo(
    () => itens.filter((i) => !search.prof || i.profissional_id === search.prof),
    [itens, search.prof],
  );
  const salasAtivas = salas.filter((s) => s.ativa);
  const podeCriar = podeAgendar(me.papeis);

  const irPara = (d: string) => navigate({ search: (s) => ({ ...s, data: d }) });
  const dataObj = parseISO(data);

  return (
    <div>
      <PageHeader
        titulo="Agenda"
        descricao={format(dataObj, "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })}
        acoes={
          podeCriar && (
            <Button onClick={() => setNovo({ data })}>
              <Plus /> Agendar
            </Button>
          )
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <div className="flex items-center rounded-xl border bg-card p-1">
          <Button variant="ghost" size="icon" onClick={() => irPara(format(addDays(dataObj, -1), "yyyy-MM-dd"))} aria-label="Dia anterior">
            <ChevronLeft />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => irPara(hoje())}>
            Hoje
          </Button>
          <Button variant="ghost" size="icon" onClick={() => irPara(format(addDays(dataObj, 1), "yyyy-MM-dd"))} aria-label="Próximo dia">
            <ChevronRight />
          </Button>
        </div>
        <Input type="date" value={data} onChange={(e) => e.target.value && irPara(e.target.value)} className="w-auto" />
        <Select value={search.prof ?? "todos"} onValueChange={(v) => navigate({ search: (s) => ({ ...s, prof: v === "todos" ? undefined : v }) })}>
          <SelectTrigger className="w-full sm:w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os profissionais</SelectItem>
            {me.papeis.includes("profissional") && <SelectItem value={me.id}>Minha agenda</SelectItem>}
            {profissionais
              .filter((p) => p.id !== me.id)
              .map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.nome}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </div>

      {/* Mobile: lista */}
      <div className="space-y-2 md:hidden">
        {filtrados.length === 0 && <Vazio />}
        {filtrados.map((i) => (
          <button
            key={i.id}
            onClick={() => setDetalhe(i)}
            className={cn("flex w-full items-center gap-3 rounded-xl border border-l-4 bg-card p-3 text-left", barraEsp(i.especialidade?.cor), i.status === "cancelado" && "opacity-50")}
          >
            <div className="w-14 shrink-0 text-center">
              <div className="font-display text-lg font-semibold">{fmtHora(i.inicio)}</div>
              <div className="text-xs text-muted-foreground">{fmtHora(i.fim)}</div>
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium">{i.paciente?.nome}</div>
              <div className="truncate text-xs text-muted-foreground">
                {i.especialidade?.nome} · {i.profissional?.nome}
              </div>
              <div className="truncate text-xs text-muted-foreground">{i.sala?.nome}</div>
            </div>
            <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium", STATUS_AGENDA[i.status].className)}>
              {STATUS_AGENDA[i.status].label}
            </span>
          </button>
        ))}
      </div>

      {/* Desktop: grade sala x horário */}
      <div className="hidden overflow-x-auto rounded-2xl border bg-card md:block">
        <div className="grid min-w-[720px]" style={{ gridTemplateColumns: `64px repeat(${salasAtivas.length}, minmax(160px, 1fr))` }}>
          <div className="sticky top-0 border-b bg-surface" />
          {salasAtivas.map((s) => (
            <div key={s.id} className="border-b border-l bg-surface px-3 py-3 text-sm font-semibold">
              {s.nome}
            </div>
          ))}

          <div className="relative" style={{ height: (HORA_FIM - HORA_INI) * PX_HORA }}>
            {Array.from({ length: HORA_FIM - HORA_INI }, (_, h) => (
              <div key={h} className="absolute right-2 -translate-y-2 text-xs text-muted-foreground" style={{ top: h * PX_HORA }}>
                {h > 0 && `${String(HORA_INI + h).padStart(2, "0")}:00`}
              </div>
            ))}
          </div>

          {salasAtivas.map((s) => (
            <div key={s.id} className="relative border-l" style={{ height: (HORA_FIM - HORA_INI) * PX_HORA }}>
              {Array.from({ length: (HORA_FIM - HORA_INI) * 2 }, (_, slot) => {
                const hora = `${String(HORA_INI + Math.floor(slot / 2)).padStart(2, "0")}:${slot % 2 ? "30" : "00"}`;
                return (
                  <div
                    key={slot}
                    className={cn("absolute inset-x-0 border-t", slot % 2 ? "border-dashed border-border/60" : "border-border", podeCriar && "cursor-pointer hover:bg-secondary/40")}
                    style={{ top: (slot * PX_HORA) / 2, height: PX_HORA / 2 }}
                    onClick={() => podeCriar && setNovo({ data, hora, salaId: s.id })}
                  />
                );
              })}
              {filtrados
                .filter((i) => i.sala_id === s.id)
                .map((i) => {
                  const ini = parseISO(i.inicio);
                  const top = ((ini.getHours() - HORA_INI) * 60 + ini.getMinutes()) * (PX_HORA / 60);
                  const h = Math.max(28, differenceInMinutes(parseISO(i.fim), ini) * (PX_HORA / 60) - 3);
                  return (
                    <button
                      key={i.id}
                      onClick={() => setDetalhe(i)}
                      className={cn(
                        "absolute inset-x-1.5 z-10 overflow-hidden rounded-lg border px-2 py-1.5 text-left text-xs shadow-sm transition hover:shadow-md",
                        corEsp(i.especialidade?.cor),
                        i.status === "cancelado" && "opacity-40",
                      )}
                      style={{ top: top + 1, height: h }}
                    >
                      <div className="truncate font-semibold text-foreground">{i.paciente?.nome}</div>
                      <div className="truncate text-foreground/70">
                        {fmtHora(i.inicio)} · {i.profissional?.nome}
                      </div>
                      {h > 56 && <div className="mt-0.5 truncate">{STATUS_AGENDA[i.status].label}</div>}
                    </button>
                  );
                })}
            </div>
          ))}
        </div>
      </div>

      {novo && <AgendamentoDialog open={!!novo} onOpenChange={(v) => !v && setNovo(null)} padrao={novo} />}
      <AgendamentoDetalhe item={detalhe} onClose={() => setDetalhe(null)} />
    </div>
  );
}

function Vazio() {
  return <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">Nenhum atendimento neste dia.</div>;
}
