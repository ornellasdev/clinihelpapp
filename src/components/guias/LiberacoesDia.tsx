import { useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { addDays, format, parseISO, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AlertTriangle, BellRing, CheckCircle2, ChevronLeft, ChevronRight, Clock, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { agendaQuery, conveniosQuery, guiasQuery, guiasUsoQuery, type AgendaItem, type Guia } from "@/lib/queries";
import { useMe } from "@/hooks/use-me";
import { podeLiberarSessao } from "@/lib/permissions";
import {
  ALERTA_SESSAO,
  STATUS_LIBERACAO,
  alertaSessao,
  avisosGuias,
  exigeGuia,
  guiaParaSessao,
  saldoGuia,
  usoPorGuia,
  type StatusLiberacao,
} from "@/lib/guias";
import { STATUS_AGENDA, barraEsp, erroAmigavel, fmtData, fmtHora } from "@/lib/ui-helpers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

export function intervaloDia(data: string) {
  const ini = startOfDay(parseISO(data));
  return [ini.toISOString(), addDays(ini, 1).toISOString()] as const;
}

const SEM_GUIA = "nenhuma";

/** Sessões de convênio do dia que pedem guia, com alerta de risco de glosa. */
export function useSessoesConvenio(itens: readonly AgendaItem[], data: string, ativo: boolean) {
  // useQuery (não suspense) para a agenda poder chamar sem bloquear quem não vê guias.
  const { data: guias = [] } = useQuery({ ...guiasQuery, enabled: ativo });
  const { data: usoLinhas = [] } = useQuery({ ...guiasUsoQuery, enabled: ativo });
  const { data: convenios = [] } = useQuery({ ...conveniosQuery, enabled: ativo });
  return useMemo(() => {
    const uso = usoPorGuia(usoLinhas);
    const tipo = new Map(convenios.map((c) => [c.id, c]));
    const sessoes = ativo && convenios.length
      ? itens
          .filter((i) => i.status !== "cancelado" && exigeGuia(tipo.get(i.paciente?.convenio_id ?? "")?.tipo))
          .map((i) => {
            const s = { paciente_id: i.paciente_id, especialidade_id: i.especialidade_id, data, guia_id: i.liberacao?.guia_id ?? null };
            const vinculada = s.guia_id ? (guias.find((g) => g.id === s.guia_id) ?? null) : null;
            return {
              item: i,
              convenio: tipo.get(i.paciente?.convenio_id ?? "")?.nome ?? "",
              status: (i.liberacao?.status ?? "pendente") as StatusLiberacao,
              vinculada,
              guia: vinculada ?? guiaParaSessao(guias, uso, s),
              alerta: alertaSessao(guias, uso, s),
            };
          })
      : [];
    return { sessoes, guias, uso };
  }, [itens, data, ativo, guias, usoLinhas, convenios]);
}
export type SessaoConvenio = ReturnType<typeof useSessoesConvenio>["sessoes"][number];

export function LiberacoesDia({ data, onData, onAbrirGuia }: { data: string; onData: (d: string) => void; onAbrirGuia: (g: Guia) => void }) {
  const me = useMe();
  const [a, b] = intervaloDia(data);
  const { data: itens } = useSuspenseQuery(agendaQuery(a, b));
  const { sessoes, guias, uso } = useSessoesConvenio(itens, data, true);
  const [soPendencias, setSoPendencias] = useState(false);
  const hoje = format(new Date(), "yyyy-MM-dd");
  const avisos = useMemo(() => avisosGuias(guias, uso, hoje), [guias, uso, hoje]);
  const pode = podeLiberarSessao(me.papeis);
  const dataObj = parseISO(data);

  const contagem = {
    pendente: sessoes.filter((s) => s.status === "pendente").length,
    aguardando: sessoes.filter((s) => s.status === "aguardando").length,
    liberado: sessoes.filter((s) => s.status === "liberado").length,
    alerta: sessoes.filter((s) => s.alerta).length,
  };
  const visiveis = soPendencias ? sessoes.filter((s) => s.status !== "liberado" || s.alerta) : sessoes;

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center rounded-xl border bg-card p-1">
          <Button variant="ghost" size="icon" onClick={() => onData(format(addDays(dataObj, -1), "yyyy-MM-dd"))} aria-label="Dia anterior">
            <ChevronLeft />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onData(hoje)}>
            Hoje
          </Button>
          <Button variant="ghost" size="icon" onClick={() => onData(format(addDays(dataObj, 1), "yyyy-MM-dd"))} aria-label="Próximo dia">
            <ChevronRight />
          </Button>
        </div>
        <Input type="date" value={data} onChange={(e) => e.target.value && onData(e.target.value)} className="w-auto" aria-label="Data" />
        <span className="text-sm capitalize text-muted-foreground">{format(dataObj, "EEEE, d 'de' MMMM", { locale: ptBR })}</span>
        <label className="flex items-center gap-2 text-sm sm:ml-auto">
          <Switch checked={soPendencias} onCheckedChange={setSoPendencias} />
          Só pendências
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Contador label="Pendentes de solicitação" valor={contagem.pendente} tom="alerta" />
        <Contador label="Aguardando o plano" valor={contagem.aguardando} />
        <Contador label="Liberados" valor={contagem.liberado} tom="ok" />
        <Contador label="Com risco de glosa" valor={contagem.alerta} tom={contagem.alerta ? "perigo" : undefined} />
      </div>

      {avisos.length > 0 && (
        <section className="rounded-2xl border border-warning/40 bg-warning/10 p-4">
          <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <BellRing className="size-4" /> Pedir renovação ({avisos.length})
          </h2>
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {avisos.slice(0, 10).map((av) => (
              <li key={av.guia.id}>
                <button onClick={() => onAbrirGuia(av.guia)} className="w-full rounded-lg bg-card/70 px-3 py-2 text-left text-sm hover:bg-card">
                  <span className="font-medium">{av.guia.paciente?.nome}</span>
                  <span className="text-muted-foreground"> · {av.guia.especialidade?.nome} · Guia {av.guia.codigo_guia}</span>
                  <span className="block text-xs text-warning-foreground">
                    {[
                      av.vence && (av.diasParaVencer <= 0 ? "Vence hoje" : `Vence em ${av.diasParaVencer} ${av.diasParaVencer === 1 ? "dia" : "dias"}`),
                      av.poucas && `Restam ${av.saldo} de ${av.guia.sessoes_autorizadas} sessões`,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {visiveis.length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          {sessoes.length === 0 ? "Nenhuma sessão de convênio ou liminar neste dia." : "Tudo liberado neste dia."}
        </div>
      ) : (
        <ul className="grid gap-3">
          {visiveis.map((s) => (
            <SessaoCard key={s.item.id} s={s} guias={guias} uso={uso} pode={pode} data={data} />
          ))}
        </ul>
      )}
    </div>
  );
}

function SessaoCard({ s, guias, uso, pode, data }: { s: SessaoConvenio; guias: Guia[]; uso: ReadonlyMap<string, number>; pode: boolean; data: string }) {
  const qc = useQueryClient();
  const i = s.item;
  const [token, setToken] = useState(i.liberacao?.token ?? "");
  const [salvando, setSalvando] = useState<string | null>(null);
  const opcoes = guias.filter(
    (g) => g.paciente_id === i.paciente_id && g.especialidade_id === i.especialidade_id && (g.status === "autorizada" || g.id === s.vinculada?.id),
  );

  async function gravar(patch: { status?: StatusLiberacao; token?: string | null; guia_id?: string | null }, chave: string) {
    setSalvando(chave);
    const status = patch.status ?? s.status;
    const guiaAtual = i.liberacao?.guia_id ?? null;
    const guia_id = patch.guia_id !== undefined ? patch.guia_id : (guiaAtual ?? (status === "liberado" ? (s.guia?.id ?? null) : null));
    const { error } = await supabase
      .from("liberacoes_atendimento")
      .upsert(
        { agendamento_id: i.id, status, token: patch.token !== undefined ? patch.token : (i.liberacao?.token ?? null), guia_id },
        { onConflict: "agendamento_id" },
      );
    setSalvando(null);
    if (error) return void toast.error(erroAmigavel(error.message));
    if (patch.status === "liberado") toast.success(`${i.paciente?.nome}: liberado.`);
    qc.invalidateQueries({ queryKey: ["agenda"] });
    qc.invalidateQueries({ queryKey: ["guias"] });
  }

  const salvarToken = () => {
    const t = token.trim();
    if (t === (i.liberacao?.token ?? "")) return;
    gravar({ token: t || null }, "token");
  };

  const g = s.guia;
  const saldo = g ? saldoGuia(g, uso.get(g.id) ?? 0) : 0;

  return (
    <li className={cn("rounded-2xl border border-l-4 bg-card p-4", barraEsp(i.especialidade?.cor), s.alerta && "ring-1 ring-destructive/30")}>
      <div className="flex flex-wrap items-start gap-3">
        <div className="w-14 shrink-0 text-center">
          <div className="font-display text-lg font-semibold">{fmtHora(i.inicio)}</div>
          <div className="text-xs text-muted-foreground">{fmtHora(i.fim)}</div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{i.paciente?.nome}</span>
            <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", STATUS_AGENDA[i.status].className)}>{STATUS_AGENDA[i.status].label}</span>
          </div>
          <div className="text-xs text-muted-foreground">
            {i.especialidade?.nome} · {i.profissional?.nome} · {s.convenio}
          </div>
          {g ? (
            <div className="mt-1 text-xs">
              Guia <strong>{g.codigo_guia}</strong> · TUSS {g.codigo_tuss} ·{" "}
              <span className={cn(saldo <= 2 && "font-semibold text-warning-foreground")}>
                Restam {saldo} de {g.sessoes_autorizadas ?? 0} sessões
              </span>
              {g.validade && <span className="text-muted-foreground"> · válida até {fmtData(g.validade)}</span>}
              {!s.vinculada && <span className="text-muted-foreground"> (sugerida)</span>}
            </div>
          ) : null}
          {s.alerta && (
            <div className="mt-1.5 inline-flex items-center gap-1.5 rounded-lg bg-destructive/10 px-2 py-1 text-xs font-medium text-destructive">
              <AlertTriangle className="size-3.5" /> {ALERTA_SESSAO[s.alerta]}
            </div>
          )}
        </div>
        {i.liberacao?.status === "liberado" && (
          <span className="flex shrink-0 items-center gap-1 text-xs text-success">
            <CheckCircle2 className="size-4" /> Liberado
          </span>
        )}
      </div>

      {pode ? (
        <div className="mt-3 grid gap-2 border-t pt-3 md:grid-cols-[auto_1fr_1fr]">
          <div className="grid grid-cols-3 gap-1 rounded-xl bg-surface p-1" role="group" aria-label="Status da liberação">
            {(Object.keys(STATUS_LIBERACAO) as StatusLiberacao[]).map((st) => (
              <button
                key={st}
                type="button"
                aria-pressed={s.status === st}
                disabled={!!salvando}
                onClick={() => st !== s.status && gravar({ status: st }, st)}
                title={STATUS_LIBERACAO[st].label}
                className={cn(
                  "flex items-center justify-center gap-1 rounded-lg px-2.5 py-2 text-xs font-medium transition-colors",
                  s.status === st ? STATUS_LIBERACAO[st].className + " shadow-sm" : "text-muted-foreground hover:bg-card",
                )}
              >
                {salvando === st ? <Loader2 className="size-3 animate-spin" /> : st === "aguardando" ? <Clock className="size-3" /> : null}
                {STATUS_LIBERACAO[st].curto}
              </button>
            ))}
          </div>
          <Input
            value={token}
            maxLength={80}
            placeholder="Token / senha do dia (opcional)"
            aria-label="Token ou senha do dia"
            onChange={(e) => setToken(e.target.value)}
            onBlur={salvarToken}
            onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()}
          />
          <Select value={i.liberacao?.guia_id ?? SEM_GUIA} onValueChange={(v) => gravar({ guia_id: v === SEM_GUIA ? null : v }, "guia")}>
            <SelectTrigger aria-label="Guia vinculada">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={SEM_GUIA}>{s.guia && !s.vinculada ? `Automática (${s.guia.codigo_guia})` : "Sem guia vinculada"}</SelectItem>
              {opcoes.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  Guia {o.codigo_guia} · restam {saldoGuia(o, uso.get(o.id) ?? 0)}
                  {o.validade && o.validade < data ? " · vencida" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : (
        <div className="mt-2 text-xs text-muted-foreground">
          {STATUS_LIBERACAO[s.status].label}
          {i.liberacao?.token ? ` · Token ${i.liberacao.token}` : ""}
        </div>
      )}
    </li>
  );
}

function Contador({ label, valor, tom }: { label: string; valor: number; tom?: "alerta" | "ok" | "perigo" | undefined }) {
  return (
    <div
      className={cn(
        "rounded-2xl border bg-card p-4",
        tom === "perigo" && "border-destructive/40 bg-destructive/5",
        tom === "alerta" && valor > 0 && "border-warning/50",
      )}
    >
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={cn("mt-1 font-display text-2xl font-semibold tabular-nums", tom === "perigo" && "text-destructive", tom === "ok" && "text-success")}>{valor}</div>
    </div>
  );
}
