import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { format } from "date-fns";
import { CalendarPlus, Clock, Hourglass, MoreVertical, Pencil, Phone, Plus, RotateCcw, Trash2, UserX, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { equipeQuery, especialidadesQuery, listaEsperaQuery, salasQuery, type ItemEspera } from "@/lib/queries";
import { useMe } from "@/hooks/use-me";
import { useClinica } from "@/hooks/use-clinica";
import { podeAgendar } from "@/lib/permissions";
import { DIAS_SEMANA, PERIODOS, STATUS_ESPERA, combinaHorario, diasAguardando, ordenarFila, posicoesNaFila } from "@/lib/lista-espera";
import { corEsp, erroAmigavel, fmtData, idade } from "@/lib/ui-helpers";
import { PageHeader } from "@/components/PageHeader";
import { EsperaDialog } from "@/components/espera/EsperaDialog";
import { AgendamentoDialog, type NovoAgendamentoPadrao } from "@/components/agenda/AgendamentoDialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

const TODOS = "todos";

export const Route = createFileRoute("/_authenticated/$clinica/espera")({
  validateSearch: z.object({
    esp: z.string().optional(),
    dia: z.coerce.number().int().min(1).max(6).optional(),
    periodo: z.enum(["manha", "tarde", "noite"]).optional(),
    status: z.enum(["aguardando", "agendado", "desistiu", "todos"]).optional(),
  }),
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(listaEsperaQuery),
      context.queryClient.ensureQueryData(especialidadesQuery),
      context.queryClient.ensureQueryData(equipeQuery),
      context.queryClient.ensureQueryData(salasQuery),
    ]),
  head: () => ({ meta: [{ title: "Lista de espera — CliniHelp" }] }),
  component: EsperaPage,
});

function EsperaPage() {
  const me = useMe();
  const clinica = useClinica();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const qc = useQueryClient();
  const { data: lista } = useSuspenseQuery(listaEsperaQuery);
  const { data: especialidades } = useSuspenseQuery(especialidadesQuery);
  const pode = podeAgendar(me.papeis);
  const status = search.status ?? "aguardando";

  const [editar, setEditar] = useState<ItemEspera | null>(null);
  const [novoAberto, setNovoAberto] = useState(false);
  const [agendar, setAgendar] = useState<{ item: ItemEspera; padrao: NovoAgendamentoPadrao } | null>(null);
  const [excluir, setExcluir] = useState<ItemEspera | null>(null);

  const aguardando = useMemo(() => lista.filter((i) => i.status === "aguardando"), [lista]);
  const posicoes = useMemo(() => posicoesNaFila(aguardando), [aguardando]);
  const porEsp = useMemo(() => {
    const m = new Map<string, number>();
    for (const i of aguardando) m.set(i.especialidade_id, (m.get(i.especialidade_id) ?? 0) + 1);
    return m;
  }, [aguardando]);

  const filtrados = useMemo(() => {
    const base = lista.filter(
      (i) =>
        (status === TODOS || i.status === status) &&
        (!search.esp || i.especialidade_id === search.esp) &&
        combinaHorario(i, search.dia, search.periodo),
    );
    return status === "aguardando" ? ordenarFila(base) : [...base].sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  }, [lista, status, search.esp, search.dia, search.periodo]);

  const setBusca = (patch: Partial<typeof search>) => navigate({ search: (s) => ({ ...s, ...patch }) });

  async function mudarStatus(item: ItemEspera, novo: "aguardando" | "agendado" | "desistiu", silencioso = false) {
    const { error } = await supabase
      .from("lista_espera")
      .update({ status: novo, encerrado_em: novo === "aguardando" ? null : new Date().toISOString() })
      .eq("id", item.id);
    if (error) {
      toast.error(erroAmigavel(error.message));
      return;
    }
    if (!silencioso) toast.success(novo === "aguardando" ? "Paciente voltou para a fila." : `Marcado como “${STATUS_ESPERA[novo]}”.`);
    qc.invalidateQueries({ queryKey: ["lista_espera"] });
  }

  async function remover(item: ItemEspera) {
    const { error } = await supabase.from("lista_espera").delete().eq("id", item.id);
    if (error) {
      toast.error(erroAmigavel(error.message));
      return;
    }
    toast.success("Pedido removido da lista.");
    qc.invalidateQueries({ queryKey: ["lista_espera"] });
  }

  return (
    <div>
      <PageHeader
        titulo="Lista de espera"
        descricao={`${aguardando.length} ${aguardando.length === 1 ? "paciente aguardando" : "pacientes aguardando"} vaga`}
        acoes={
          pode && (
            <Button onClick={() => setNovoAberto(true)}>
              <Plus /> Incluir paciente
            </Button>
          )
        }
      />

      {especialidades.length > 0 && (
        <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
          <FiltroEsp ativo={!search.esp} onClick={() => setBusca({ esp: undefined })} label="Todas" n={aguardando.length} />
          {especialidades.map((e) => (
            <FiltroEsp key={e.id} ativo={search.esp === e.id} onClick={() => setBusca({ esp: e.id })} label={e.nome} n={porEsp.get(e.id) ?? 0} />
          ))}
        </div>
      )}

      <div className="mb-5 flex flex-wrap gap-2">
        <Select value={search.dia ? String(search.dia) : TODOS} onValueChange={(v) => setBusca({ dia: v === TODOS ? undefined : Number(v) })}>
          <SelectTrigger className="w-40" aria-label="Dia da vaga">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Qualquer dia</SelectItem>
            {DIAS_SEMANA.map((d) => (
              <SelectItem key={d.v} value={String(d.v)}>
                Vaga na {d.l.toLowerCase()}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={search.periodo ?? TODOS} onValueChange={(v) => setBusca({ periodo: v === TODOS ? undefined : (v as "manha" | "tarde" | "noite") })}>
          <SelectTrigger className="w-40" aria-label="Período da vaga">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Qualquer período</SelectItem>
            {PERIODOS.map((p) => (
              <SelectItem key={p.v} value={p.v}>
                {p.l}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={(v) => setBusca({ status: v === "aguardando" ? undefined : (v as "agendado" | "desistiu" | "todos") })}>
          <SelectTrigger className="w-40" aria-label="Situação">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="aguardando">Aguardando</SelectItem>
            <SelectItem value="agendado">Já agendados</SelectItem>
            <SelectItem value="desistiu">Desistências</SelectItem>
            <SelectItem value={TODOS}>Todos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtrados.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-10 text-center">
          <Hourglass className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">
            {lista.length === 0 ? "Ninguém na lista de espera ainda." : "Nenhum pedido com esses filtros."}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {filtrados.map((i) => {
            const dias = diasAguardando(i.created_at);
            const pos = posicoes.get(i.id);
            return (
              <article key={i.id} className="flex gap-3 rounded-2xl border bg-card p-4">
                {i.status === "aguardando" && pos !== undefined && (
                  <div className="flex size-10 shrink-0 flex-col items-center justify-center rounded-xl bg-secondary font-display text-secondary-foreground" title="Posição na fila da especialidade">
                    <span className="text-[9px] uppercase leading-none">fila</span>
                    <span className="text-base font-semibold leading-tight">{pos}º</span>
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link to="/$clinica/pacientes/$id" params={{ clinica, id: i.paciente_id }} className="block truncate font-semibold hover:underline">
                        {i.paciente?.nome}
                      </Link>
                      <div className="text-xs text-muted-foreground">
                        {idade(i.paciente?.data_nascimento)}
                        {i.paciente?.responsavel_nome && ` · Resp.: ${i.paciente.responsavel_nome}`}
                      </div>
                    </div>
                    {pode && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="-mr-2 -mt-1 shrink-0" aria-label="Ações">
                            <MoreVertical />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onSelect={() => setEditar(i)}>
                            <Pencil /> Editar
                          </DropdownMenuItem>
                          {i.status === "aguardando" ? (
                            <>
                              <DropdownMenuItem onSelect={() => mudarStatus(i, "agendado")}>
                                <CheckCircle2 /> Marcar como agendado
                              </DropdownMenuItem>
                              <DropdownMenuItem onSelect={() => mudarStatus(i, "desistiu")}>
                                <UserX /> Desistiu da vaga
                              </DropdownMenuItem>
                            </>
                          ) : (
                            <DropdownMenuItem onSelect={() => mudarStatus(i, "aguardando")}>
                              <RotateCcw /> Voltar para a fila
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => setExcluir(i)}>
                            <Trash2 /> Excluir pedido
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <span className={cn("rounded-full border px-2 py-0.5 text-xs font-medium", corEsp(i.especialidade?.cor))}>{i.especialidade?.nome}</span>
                    {i.prioridade === "alta" && <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">Prioridade alta</span>}
                    {i.status !== "aguardando" && (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                        {STATUS_ESPERA[i.status]}
                        {i.encerrado_em && ` em ${fmtData(i.encerrado_em)}`}
                      </span>
                    )}
                  </div>

                  <dl className="mt-3 grid gap-1 text-sm">
                    <div className="flex gap-2">
                      <dt className="w-24 shrink-0 text-muted-foreground">Profissional</dt>
                      <dd className="min-w-0 truncate">{i.profissional?.nome ?? "Qualquer"}</dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="w-24 shrink-0 text-muted-foreground">Disponível</dt>
                      <dd className="min-w-0">
                        {descreverDias(i.dias_semana)} · {descreverPeriodos(i.periodos)}
                        {i.horario_obs && <span className="block text-xs text-muted-foreground">{i.horario_obs}</span>}
                      </dd>
                    </div>
                    {i.observacoes && (
                      <div className="flex gap-2">
                        <dt className="w-24 shrink-0 text-muted-foreground">Obs.</dt>
                        <dd className="min-w-0 whitespace-pre-line">{i.observacoes}</dd>
                      </div>
                    )}
                  </dl>

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t pt-3">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="size-3.5" />
                        {dias === 0 ? "Entrou hoje" : `Aguardando há ${dias} ${dias === 1 ? "dia" : "dias"}`} · desde {format(new Date(i.created_at), "dd/MM/yyyy")}
                      </span>
                      {i.paciente?.responsavel_telefone && (
                        <a href={`tel:${i.paciente.responsavel_telefone.replace(/\D/g, "")}`} className="inline-flex items-center gap-1 hover:text-foreground">
                          <Phone className="size-3.5" />
                          {i.paciente.responsavel_telefone}
                        </a>
                      )}
                    </div>
                    {pode && i.status === "aguardando" && (
                      <Button
                        size="sm"
                        onClick={() =>
                          setAgendar({
                            item: i,
                            padrao: {
                              data: format(new Date(), "yyyy-MM-dd"),
                              pacienteId: i.paciente_id,
                              especialidadeId: i.especialidade_id,
                              ...(i.profissional_id ? { profissionalId: i.profissional_id } : {}),
                            },
                          })
                        }
                      >
                        <CalendarPlus /> Agendar vaga
                      </Button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <EsperaDialog
        open={novoAberto || !!editar}
        item={editar}
        onOpenChange={(v) => {
          if (!v) {
            setNovoAberto(false);
            setEditar(null);
          }
        }}
      />
      {agendar && (
        <AgendamentoDialog
          open={!!agendar}
          padrao={agendar.padrao}
          onOpenChange={(v) => !v && setAgendar(null)}
          onCriado={() => {
            void mudarStatus(agendar.item, "agendado", true);
            toast.success("Paciente saiu da lista de espera.");
          }}
        />
      )}
      <AlertDialog open={!!excluir} onOpenChange={(v) => !v && setExcluir(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir pedido de vaga?</AlertDialogTitle>
            <AlertDialogDescription>
              {excluir?.paciente?.nome} sai da lista de {excluir?.especialidade?.nome}. Se o paciente apenas desistiu, prefira “Desistiu da vaga” para manter o histórico.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (excluir) void remover(excluir);
                setExcluir(null);
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function descreverDias(dias: number[]) {
  if (!dias.length) return "Qualquer dia";
  return DIAS_SEMANA.filter((d) => dias.includes(d.v))
    .map((d) => d.l)
    .join(", ");
}

function descreverPeriodos(p: string[]) {
  if (!p.length) return "qualquer período";
  return PERIODOS.filter((x) => p.includes(x.v))
    .map((x) => x.l.toLowerCase())
    .join(", ");
}

function FiltroEsp({ ativo, onClick, label, n }: { ativo: boolean; onClick: () => void; label: string; n: number }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ativo}
      className={cn(
        "flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-colors",
        ativo ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-secondary",
      )}
    >
      {label}
      <span className={cn("rounded-full px-1.5 text-xs", ativo ? "bg-primary-foreground/20" : "bg-muted text-muted-foreground")}>{n}</span>
    </button>
  );
}
