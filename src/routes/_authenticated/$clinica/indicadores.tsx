import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { addMonths, format, parseISO, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { z } from "zod";
import { DoorOpen, Hourglass, UserX, Wallet, CircleDollarSign } from "lucide-react";
import { aReceberQuery, glosasQuery, indicadoresQuery, listaEsperaQuery, meQuery, salasQuery } from "@/lib/queries";
import { resumoGlosas } from "@/lib/guias";
import { useClinica } from "@/hooks/use-clinica";
import { useMe } from "@/hooks/use-me";
import { podeGerirFinanceiro } from "@/lib/permissions";
import { formatarMoeda } from "@/lib/financeiro";
import { HORARIO_PADRAO, horasDisponiveisPorSala, minutosOcupados, percentual, resumoFinanceiro, taxaFaltas, type HorarioFuncionamento } from "@/lib/indicadores";
import { PageHeader } from "@/components/PageHeader";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

const mesAtual = () => format(new Date(), "yyyy-MM");
const intervaloMes = (mes: string) => {
  const ini = startOfMonth(parseISO(`${mes}-01`));
  return [ini.toISOString(), addMonths(ini, 1).toISOString()] as const;
};

export const Route = createFileRoute("/_authenticated/$clinica/indicadores")({
  validateSearch: z.object({ mes: z.string().regex(/^\d{4}-\d{2}$/).optional() }),
  beforeLoad: async ({ context, params }) => {
    const me = await context.queryClient.ensureQueryData(meQuery);
    if (!podeGerirFinanceiro(me.papeis)) throw redirect({ to: "/$clinica/painel", params });
  },
  loaderDeps: ({ search }) => ({ mes: search.mes ?? mesAtual() }),
  loader: ({ context, deps }) => {
    const [a, b] = intervaloMes(deps.mes);
    return Promise.all([
      context.queryClient.ensureQueryData(indicadoresQuery(a, b)),
      context.queryClient.ensureQueryData(aReceberQuery(b)),
      context.queryClient.ensureQueryData(salasQuery),
      context.queryClient.ensureQueryData(listaEsperaQuery),
      context.queryClient.ensureQueryData(glosasQuery),
    ]);
  },
  head: () => ({ meta: [{ title: "Indicadores (KPI) — CliniHelp" }] }),
  component: IndicadoresPage,
});

const HORAS = Array.from({ length: 17 }, (_, i) => i + 6); // 06h a 22h

function useHorario(chave: string) {
  const [h, setH] = useState<HorarioFuncionamento>(HORARIO_PADRAO);
  useEffect(() => {
    try {
      const salvo = localStorage.getItem(chave);
      if (salvo) setH({ ...HORARIO_PADRAO, ...(JSON.parse(salvo) as Partial<HorarioFuncionamento>) });
    } catch {
      /* usa o padrão */
    }
  }, [chave]);
  const salvar = (novo: HorarioFuncionamento) => {
    setH(novo);
    try {
      localStorage.setItem(chave, JSON.stringify(novo));
    } catch {
      /* sem armazenamento: vale só nesta visita */
    }
  };
  return [h, salvar] as const;
}

function IndicadoresPage() {
  const clinica = useClinica();
  const me = useMe();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const mes = search.mes ?? mesAtual();
  const [a, b] = intervaloMes(mes);
  const { data: sessoes } = useSuspenseQuery(indicadoresQuery(a, b));
  const { data: pendentes } = useSuspenseQuery(aReceberQuery(b));
  const { data: salas } = useSuspenseQuery(salasQuery);
  const { data: espera } = useSuspenseQuery(listaEsperaQuery);
  const { data: glosas } = useSuspenseQuery(glosasQuery);
  const [horario, setHorario] = useHorario(`clinihelp:horario:${me.clinica?.id ?? clinica}`);

  const salasAtivas = salas.filter((s) => s.ativa);
  const horasSala = horasDisponiveisPorSala(mes, horario);

  const ocupacao = useMemo(() => {
    const porSala = salasAtivas.map((s) => {
      const horas = minutosOcupados(sessoes.filter((x) => x.sala_id === s.id)) / 60;
      return { id: s.id, nome: s.nome, horas, pct: percentual(horas, horasSala) };
    });
    const total = porSala.reduce((t, s) => t + s.horas, 0);
    return { porSala: porSala.sort((x, y) => y.pct - x.pct), pct: percentual(total, horasSala * salasAtivas.length), horas: total };
  }, [sessoes, salasAtivas, horasSala]);

  const faltas = useMemo(() => {
    const geral = taxaFaltas(sessoes);
    const esp = new Map<string, { nome: string; itens: { status: string }[] }>();
    const pac = new Map<string, { id: string; nome: string; n: number }>();
    for (const s of sessoes) {
      const e = esp.get(s.especialidade_id) ?? { nome: s.especialidade?.nome ?? "—", itens: [] };
      e.itens.push(s);
      esp.set(s.especialidade_id, e);
      if (s.status === "falta") {
        const p = pac.get(s.paciente_id) ?? { id: s.paciente_id, nome: s.paciente?.nome ?? "—", n: 0 };
        p.n++;
        pac.set(s.paciente_id, p);
      }
    }
    const porEsp = [...esp.values()]
      .map((e) => ({ nome: e.nome, ...taxaFaltas(e.itens) }))
      .filter((e) => e.faltas + e.realizados > 0)
      .sort((x, y) => y.taxa - x.taxa);
    const pacientes = [...pac.values()].sort((x, y) => y.n - x.n).slice(0, 5);
    return { geral, porEsp, pacientes };
  }, [sessoes]);

  const fin = useMemo(() => resumoFinanceiro(sessoes), [sessoes]);
  const totalAReceber = useMemo(() => pendentes.reduce((t, p) => t + Number(p.fin?.valor ?? 0), 0), [pendentes]);
  const aReceberPorMes = useMemo(() => {
    const m = new Map<string, { n: number; valor: number }>();
    for (const p of pendentes) {
      const k = format(parseISO(p.inicio), "yyyy-MM");
      const it = m.get(k) ?? { n: 0, valor: 0 };
      it.n++;
      it.valor += Number(p.fin?.valor ?? 0);
      m.set(k, it);
    }
    return [...m.entries()].sort((x, y) => y[0].localeCompare(x[0])).slice(0, 6);
  }, [pendentes]);
  // Retido = glosas ainda em aberto (de qualquer mês); o mês mostra o que foi glosado nele.
  const glosasGeral = useMemo(() => resumoGlosas(glosas), [glosas]);
  const glosasMes = useMemo(() => resumoGlosas(glosas.filter((g) => g.data_glosa.startsWith(mes))), [glosas, mes]);
  const aguardando = espera.filter((e) => e.status === "aguardando").length;
  const nomeMes = format(parseISO(`${mes}-01`), "MMMM 'de' yyyy", { locale: ptBR });

  return (
    <div>
      <PageHeader
        titulo="Indicadores (KPI)"
        descricao={nomeMes}
        acoes={<Input type="month" value={mes} aria-label="Mês" onChange={(e) => e.target.value && navigate({ search: { mes: e.target.value } })} className="w-auto" />}
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi icone={DoorOpen} label="Ocupação das salas" valor={`${ocupacao.pct.toLocaleString("pt-BR")}%`} sub={`${fmtHoras(ocupacao.horas)} reservadas`} />
        <Kpi icone={UserX} label="Taxa de faltas" valor={`${faltas.geral.taxa.toLocaleString("pt-BR")}%`} sub={`${faltas.geral.faltas} ${faltas.geral.faltas === 1 ? "falta" : "faltas"} no mês`} />
        <Kpi icone={Wallet} label="Faturamento do mês" valor={formatarMoeda(fin.faturado)} sub={`${formatarMoeda(fin.recebido)} já recebido`} destaque />
        <Kpi icone={CircleDollarSign} label="Valores a receber" valor={formatarMoeda(totalAReceber)} sub={`${formatarMoeda(fin.aReceber)} deste mês`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Secao titulo="Ocupação por sala" className="lg:col-span-2">
          <div className="mb-4 flex flex-wrap items-end gap-3 rounded-xl bg-surface p-3">
            <div className="grid gap-1">
              <Label className="text-xs text-muted-foreground">Abre às</Label>
              <SelectHora valor={horario.horaIni} onChange={(v) => setHorario({ ...horario, horaIni: Math.min(v, horario.horaFim - 1) })} />
            </div>
            <div className="grid gap-1">
              <Label className="text-xs text-muted-foreground">Fecha às</Label>
              <SelectHora valor={horario.horaFim} onChange={(v) => setHorario({ ...horario, horaFim: Math.max(v, horario.horaIni + 1) })} />
            </div>
            <label className="flex h-10 items-center gap-2 text-sm">
              <Switch checked={horario.sabado} onCheckedChange={(v) => setHorario({ ...horario, sabado: v })} />
              Atende aos sábados
            </label>
            <p className="text-xs text-muted-foreground sm:ml-auto">Cada sala tem {fmtHoras(horasSala)} disponíveis neste mês.</p>
          </div>
          {ocupacao.porSala.length === 0 ? (
            <Vazio>Nenhuma sala ativa cadastrada.</Vazio>
          ) : (
            <ul className="grid gap-3 md:grid-cols-2">
              {ocupacao.porSala.map((s) => (
                <li key={s.id}>
                  <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
                    <span className="truncate font-medium">{s.nome}</span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      {fmtHoras(s.horas)} · <strong className="text-foreground">{s.pct.toLocaleString("pt-BR")}%</strong>
                    </span>
                  </div>
                  <Barra pct={s.pct} />
                </li>
              ))}
            </ul>
          )}
        </Secao>

        <Secao titulo="Faltas por especialidade">
          {faltas.porEsp.length === 0 ? (
            <Vazio>Sem atendimentos realizados ou faltas neste mês.</Vazio>
          ) : (
            <ul className="grid gap-3">
              {faltas.porEsp.map((e) => (
                <li key={e.nome}>
                  <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
                    <span className="truncate font-medium">{e.nome}</span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      {e.faltas} de {e.faltas + e.realizados} · <strong className="text-foreground">{e.taxa.toLocaleString("pt-BR")}%</strong>
                    </span>
                  </div>
                  <Barra pct={e.taxa} tom="alerta" />
                </li>
              ))}
            </ul>
          )}
          {faltas.pacientes.length > 0 && (
            <div className="mt-5 border-t pt-4">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Pacientes com mais faltas</h3>
              <ul className="divide-y text-sm">
                {faltas.pacientes.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-2 py-2">
                    <Link to="/$clinica/pacientes/$id" params={{ clinica, id: p.id }} className="truncate hover:underline">
                      {p.nome}
                    </Link>
                    <span className="shrink-0 rounded-full bg-warning/25 px-2 py-0.5 text-xs font-medium text-warning-foreground">
                      {p.n} {p.n === 1 ? "falta" : "faltas"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Secao>

        <Secao titulo="Financeiro do mês">
          <dl className="grid grid-cols-2 gap-3">
            <Valor label="Faturado (realizados)" v={fin.faturado} />
            <Valor label="Recebido" v={fin.recebido} />
            <Valor label="A receber do mês" v={fin.aReceber} />
            <Valor label="Previsto (ainda agendado)" v={fin.previsto} />
          </dl>
          <div className="mt-5 border-t pt-4">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Em aberto por mês</h3>
              <Link to="/$clinica/financeiro" params={{ clinica }} className="text-sm font-medium text-primary">
                Ver financeiro
              </Link>
            </div>
            {aReceberPorMes.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma sessão realizada pendente de pagamento.</p>
            ) : (
              <ul className="divide-y text-sm">
                {aReceberPorMes.map(([m, it]) => (
                  <li key={m} className="flex items-center justify-between gap-2 py-2">
                    <Link to="/$clinica/financeiro" params={{ clinica }} search={{ mes: m }} className="capitalize hover:underline">
                      {format(parseISO(`${m}-01`), "MMMM yyyy", { locale: ptBR })}
                    </Link>
                    <span className="tabular-nums text-muted-foreground">
                      {it.n} {it.n === 1 ? "sessão" : "sessões"} · <strong className="text-foreground">{formatarMoeda(it.valor)}</strong>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Secao>

        <Secao titulo="Glosas por convênio" className="lg:col-span-2">
          <dl className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-4">
            <Valor label="Retido em glosa (em aberto)" v={glosasGeral.total.retido} />
            <Valor label="Glosado neste mês" v={glosasMes.total.total} />
            <Valor label="Recuperado (total)" v={glosasGeral.total.recuperado} />
            <Valor label="Perda definitiva (total)" v={glosasGeral.total.perda} />
          </dl>
          {glosasGeral.porConvenio.length === 0 ? (
            <Vazio>Nenhuma glosa registrada.</Vazio>
          ) : (
            <ul className="grid gap-3 md:grid-cols-2">
              {glosasGeral.porConvenio.map((c) => (
                <li key={c.nome}>
                  <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
                    <span className="truncate font-medium">{c.nome}</span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      retido <strong className="text-foreground">{formatarMoeda(c.retido)}</strong> · recuperado {formatarMoeda(c.recuperado)} · perda {formatarMoeda(c.perda)}
                    </span>
                  </div>
                  <Barra pct={c.total > 0 ? (c.retido / c.total) * 100 : 0} tom="alerta" />
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4 text-right">
            <Link to="/$clinica/guias" params={{ clinica }} search={{ aba: "glosas" }} className="text-sm font-medium text-primary">
              Ver glosas
            </Link>
          </div>
        </Secao>

        <Link
          to="/$clinica/espera"
          params={{ clinica }}
          className="flex items-center gap-4 rounded-2xl border bg-card p-4 transition-colors hover:bg-secondary/50 lg:col-span-2"
        >
          <div className="flex size-11 items-center justify-center rounded-xl bg-secondary text-secondary-foreground">
            <Hourglass className="size-5" />
          </div>
          <div className="flex-1">
            <div className="font-semibold">Lista de espera</div>
            <div className="text-sm text-muted-foreground">
              {aguardando === 0 ? "Ninguém aguardando vaga." : `${aguardando} ${aguardando === 1 ? "paciente aguardando" : "pacientes aguardando"} vaga`}
            </div>
          </div>
          <span className="text-sm font-medium text-primary">Abrir</span>
        </Link>
      </div>
    </div>
  );
}

function fmtHoras(h: number) {
  const r = Math.round(h * 10) / 10;
  return `${r.toLocaleString("pt-BR")} h`;
}

function Kpi({ icone: Icone, label, valor, sub, destaque }: { icone: typeof Wallet; label: string; valor: string; sub: string; destaque?: boolean }) {
  return (
    <div className={cn("rounded-2xl border p-4", destaque ? "border-primary/30 bg-primary text-primary-foreground" : "bg-card")}>
      <div className={cn("flex items-center gap-1.5 text-xs", destaque ? "text-primary-foreground/80" : "text-muted-foreground")}>
        <Icone className="size-3.5" />
        {label}
      </div>
      <div className="mt-1 font-display text-xl font-semibold md:text-2xl">{valor}</div>
      <div className={cn("text-xs", destaque ? "text-primary-foreground/80" : "text-muted-foreground")}>{sub}</div>
    </div>
  );
}

function Secao({ titulo, children, className }: { titulo: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-2xl border bg-card p-4 md:p-5", className)}>
      <h2 className="mb-4 font-semibold">{titulo}</h2>
      {children}
    </section>
  );
}

function Barra({ pct, tom = "normal" }: { pct: number; tom?: "normal" | "alerta" }) {
  return (
    <div className="h-2.5 overflow-hidden rounded-full bg-muted" role="presentation">
      <div className={cn("h-full rounded-full", tom === "alerta" ? "bg-warning" : "bg-primary")} style={{ width: `${Math.min(100, pct)}%` }} />
    </div>
  );
}

function Valor({ label, v }: { label: string; v: number }) {
  return (
    <div className="rounded-xl bg-surface p-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-display text-lg font-semibold">{formatarMoeda(v)}</dd>
    </div>
  );
}

function Vazio({ children }: { children: React.ReactNode }) {
  return <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">{children}</p>;
}

function SelectHora({ valor, onChange }: { valor: number; onChange: (v: number) => void }) {
  return (
    <Select value={String(valor)} onValueChange={(v) => onChange(Number(v))}>
      <SelectTrigger className="w-24">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {HORAS.map((h) => (
          <SelectItem key={h} value={String(h)}>
            {String(h).padStart(2, "0")}:00
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
