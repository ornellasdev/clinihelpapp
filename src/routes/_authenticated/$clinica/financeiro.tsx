import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { addMonths, format, parseISO, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { z } from "zod";
import { toast } from "sonner";
import { cobrancasQuery, convenioValoresQuery, conveniosQuery, equipeQuery, financeiroQuery, meQuery, recebimentosAtivosQuery } from "@/lib/queries";
import { TabelaConvenios } from "@/components/financeiro/TabelaConvenios";
import { CobrancasAba, periodoCobrancas } from "@/components/cobrancas/CobrancasAba";
import { useMe } from "@/hooks/use-me";
import { podeGerirFinanceiro } from "@/lib/permissions";
import { formatarMoeda, repasseDevido, valorCobrado } from "@/lib/financeiro";
import { STATUS_FATURAVEIS, STATUS_PREVISTOS, type StatusAgenda } from "@/lib/agenda-status";
import { STATUS_AGENDA, fmtData, fmtHora } from "@/lib/ui-helpers";
import { lerValorReais, valorParaCampo } from "@/lib/validacao";
import { useAjustarSessao } from "@/hooks/use-financeiro";
import type { AjusteSessao } from "@/services/financeiro";
import { mensagemDeErro } from "@/services/resultado";
import { PageHeader } from "@/components/PageHeader";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { Download, FileDown, FileSpreadsheet, FileText, Receipt, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { exportarCsv, exportarPdf, exportarXlsx, montarLinhas } from "@/lib/exportar-financeiro";

const mesAtual = () => format(new Date(), "yyyy-MM");

/** Filtros de status: grupos de regra financeira e status individuais. */
const FILTROS: Record<string, { label: string; aceita: (s: StatusAgenda) => boolean }> = {
  faturaveis: { label: "Faturáveis (finalizados + faltas cobradas)", aceita: (s) => STATUS_FATURAVEIS.includes(s) },
  finalizado: { label: "Finalizados", aceita: (s) => s === "finalizado" },
  falta_cobrada: { label: "Faltas não justificadas (cobradas)", aceita: (s) => s === "falta_cobrada" },
  sem_cobranca: { label: "Faltas não cobradas", aceita: (s) => s === "falta_justificada" || s === "falta_terapeuta" },
  previstos: { label: "A atender (agendados / na clínica)", aceita: (s) => STATUS_PREVISTOS.includes(s) },
  todos: { label: "Todos (exceto cancelados)", aceita: (s) => s !== "cancelado" },
};

const ABAS = ["atendimentos", "cobrancas"] as const;

export const Route = createFileRoute("/_authenticated/$clinica/financeiro")({
  validateSearch: z.object({
    aba: z.enum(ABAS).optional(),
    mes: z.string().regex(/^\d{4}-\d{2}$/).optional(),
    prof: z.string().optional(),
    status: z.string().optional(),
    situacao: z.string().optional(),
  }),
  loaderDeps: ({ search }) => ({ mes: search.mes ?? mesAtual(), aba: search.aba ?? "atendimentos" }),
  loader: async ({ context, deps }) => {
    const qc = context.queryClient;
    const me = await qc.ensureQueryData(meQuery);
    if (deps.aba === "cobrancas" && podeGerirFinanceiro(me.papeis) && me.clinica) {
      const p = periodoCobrancas(deps.mes);
      await Promise.all([qc.ensureQueryData(cobrancasQuery(p.de, p.ate)), qc.ensureQueryData(recebimentosAtivosQuery(me.clinica.id))]);
      return;
    }
    const ini = startOfMonth(parseISO(`${deps.mes}-01`));
    await Promise.all([
      qc.ensureQueryData(financeiroQuery(ini.toISOString(), addMonths(ini, 1).toISOString())),
      qc.ensureQueryData(equipeQuery),
      qc.ensureQueryData(conveniosQuery),
      qc.ensureQueryData(convenioValoresQuery),
    ]);
  },
  head: () => ({
    meta: [
      { title: "Financeiro — CliniHelp" },
      { name: "description", content: "Atendimentos, repasses, tabela de convênios e cobranças aos responsáveis." },
    ],
  }),
  component: FinanceiroPage,
});

function FinanceiroPage() {
  const me = useMe();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const gestor = podeGerirFinanceiro(me.papeis);
  const mes = search.mes ?? mesAtual();
  const aba = gestor && search.aba === "cobrancas" ? "cobrancas" : "atendimentos";
  const nomeMes = format(startOfMonth(parseISO(`${mes}-01`)), "MMMM 'de' yyyy", { locale: ptBR });

  if (!gestor) {
    return (
      <div>
        <PageHeader titulo="Meus repasses" descricao={nomeMes} />
        <AbaAtendimentos />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        titulo="Financeiro"
        descricao={aba === "cobrancas" ? `Cobranças aos responsáveis · vencimentos de ${nomeMes}` : nomeMes}
      />
      <Tabs value={aba} onValueChange={(v) => navigate({ search: (s) => ({ ...s, aba: v === "cobrancas" ? "cobrancas" : undefined }) })}>
        <TabsList className="mb-5 h-auto w-full justify-start overflow-x-auto bg-surface p-1 sm:w-auto">
          <TabsTrigger value="atendimentos" className="flex-1 gap-2 px-4 py-2 sm:flex-none">
            <Wallet className="size-4" />
            <span>
              Atendimentos<span className="hidden sm:inline"> e repasses</span>
            </span>
          </TabsTrigger>
          <TabsTrigger value="cobrancas" className="flex-1 gap-2 px-4 py-2 sm:flex-none">
            <Receipt className="size-4" /> Cobranças
          </TabsTrigger>
        </TabsList>
        <TabsContent value="atendimentos">{aba === "atendimentos" && <AbaAtendimentos />}</TabsContent>
        <TabsContent value="cobrancas">
          {aba === "cobrancas" && (
            <CobrancasAba mes={mes} situacao={search.situacao} onFiltro={(f) => navigate({ search: (s) => ({ ...s, ...f }) })} />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function AbaAtendimentos() {
  const me = useMe();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const qc = useQueryClient();
  const mes = search.mes ?? mesAtual();
  const status = search.status && FILTROS[search.status] ? search.status : "faturaveis";
  const ini = startOfMonth(parseISO(`${mes}-01`));
  const q = financeiroQuery(ini.toISOString(), addMonths(ini, 1).toISOString());
  const { data: linhas } = useSuspenseQuery(q);
  const { data: equipe } = useSuspenseQuery(equipeQuery);
  const gestor = podeGerirFinanceiro(me.papeis);

  const filtradas = linhas.filter(
    (l) => FILTROS[status]!.aceita(l.status) && (!search.prof || l.profissional_id === search.prof),
  );

  const totais = useMemo(() => {
    const valor = filtradas.reduce((s, l) => s + valorCobrado(l.fin), 0);
    const repasse = filtradas.reduce((s, l) => s + repasseDevido(l.fin), 0);
    const recebido = filtradas.filter((l) => l.fin?.pagamento_status === "pago").reduce((s, l) => s + valorCobrado(l.fin), 0);
    const repassePago = filtradas.filter((l) => l.fin?.repasse_pago).reduce((s, l) => s + repasseDevido(l.fin), 0);
    return { valor, repasse, recebido, repassePago, liquido: valor - repasse };
  }, [filtradas]);

  const porProf = useMemo(() => {
    const m = new Map<string, { nome: string; n: number; valor: number; repasse: number }>();
    for (const l of filtradas) {
      const it = m.get(l.profissional_id) ?? { nome: l.profissional?.nome ?? "", n: 0, valor: 0, repasse: 0 };
      it.n++;
      it.valor += valorCobrado(l.fin);
      it.repasse += repasseDevido(l.fin);
      m.set(l.profissional_id, it);
    }
    return [...m.values()].sort((a, b) => a.nome.localeCompare(b.nome));
  }, [filtradas]);

  const ajustar = useAjustarSessao();
  /** Grava o ajuste validado; devolve false quando não deu (o campo volta ao valor anterior). */
  async function atualizar(id: string, patch: AjusteSessao): Promise<boolean> {
    try {
      await ajustar.mutateAsync({ id, patch });
      qc.invalidateQueries({ queryKey: q.queryKey });
      return true;
    } catch (e) {
      toast.error(mensagemDeErro(e));
      return false;
    }
  }

  const cards = gestor
    ? [
        { label: "Valor dos atendimentos", v: totais.valor },
        { label: "Recebido", v: totais.recebido },
        { label: "Repasses", v: totais.repasse, sub: `${formatarMoeda(totais.repassePago)} pagos` },
        { label: "Líquido clínica", v: totais.liquido, destaque: true },
      ]
    : [
        { label: "Atendimentos", n: filtradas.length },
        { label: "Meu repasse", v: totais.repasse, destaque: true },
        { label: "Já recebido", v: totais.repassePago },
      ];

  async function exportar(tipo: "pdf" | "csv" | "xlsx") {
    const dados = montarLinhas(filtradas, (s) => STATUS_AGENDA[s as keyof typeof STATUS_AGENDA]?.label ?? s);
    if (dados.length === 0) {
      toast.info("Não há atendimentos no período para exportar.");
      return;
    }
    const periodo = format(ini, "MMMM 'de' yyyy", { locale: ptBR });
    const prof = search.prof ? equipe.find((m) => m.id === search.prof)?.nome : undefined;
    const titulo = `${gestor ? "Financeiro" : "Meus repasses"} — ${periodo}`;
    const subtitulo = [`CliniHelp · gerado em ${format(new Date(), "dd/MM/yyyy HH:mm")}`, prof && `Profissional: ${prof}`]
      .filter(Boolean)
      .join(" · ");
    const nomeBase = `financeiro-${mes}${prof ? `-${prof.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-")}` : ""}`;
    try {
      if (tipo === "csv") exportarCsv(dados, nomeBase);
      else if (tipo === "xlsx") await exportarXlsx(dados, nomeBase, titulo);
      else await exportarPdf(dados, nomeBase, titulo, subtitulo);
    } catch {
      toast.error("Não foi possível gerar o arquivo. Tente novamente.");
    }
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap gap-2">
        <Input type="month" value={mes} onChange={(e) => e.target.value && navigate({ search: (s) => ({ ...s, mes: e.target.value }) })} className="w-auto" aria-label="Mês" />
        <Select value={status} onValueChange={(v) => navigate({ search: (s) => ({ ...s, status: v }) })}>
          <SelectTrigger className="w-full sm:w-80">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(FILTROS).map(([k, f]) => (
              <SelectItem key={k} value={k}>
                {f.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {gestor && (
          <Select value={search.prof ?? "todos"} onValueChange={(v) => navigate({ search: (s) => ({ ...s, prof: v === "todos" ? undefined : v }) })}>
            <SelectTrigger className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os profissionais</SelectItem>
              {equipe
                .filter((m) => m.papeis.includes("profissional"))
                .map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.nome}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="ml-auto">
              <Download /> Exportar
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => exportar("pdf")}>
              <FileText /> PDF
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => exportar("xlsx")}>
              <FileSpreadsheet /> Excel (.xlsx)
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => exportar("csv")}>
              <FileDown /> CSV
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className={cn("mb-6 grid gap-3", gestor ? "grid-cols-2 lg:grid-cols-4" : "grid-cols-1 sm:grid-cols-3")}>
        {cards.map((c) => (
          <div key={c.label} className={cn("rounded-2xl border p-4", c.destaque ? "border-primary/30 bg-primary text-primary-foreground" : "bg-card")}>
            <div className={cn("text-xs", c.destaque ? "text-primary-foreground/80" : "text-muted-foreground")}>{c.label}</div>
            <div className="mt-1 font-display text-xl font-semibold md:text-2xl">{"n" in c ? c.n : formatarMoeda(c.v)}</div>
            {"sub" in c && c.sub && <div className="text-xs text-muted-foreground">{c.sub}</div>}
          </div>
        ))}
      </div>

      {gestor && porProf.length > 1 && (
        <div className="mb-6 overflow-x-auto rounded-2xl border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-surface text-left text-xs text-muted-foreground">
              <tr>
                <th className="p-3">Profissional</th>
                <th className="p-3 text-right">Atend.</th>
                <th className="p-3 text-right">Valor</th>
                <th className="p-3 text-right">Repasse</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {porProf.map((p) => (
                <tr key={p.nome}>
                  <td className="p-3 font-medium">{p.nome}</td>
                  <td className="p-3 text-right">{p.n}</td>
                  <td className="p-3 text-right">{formatarMoeda(p.valor)}</td>
                  <td className="p-3 text-right font-medium">{formatarMoeda(p.repasse)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border bg-card">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="bg-surface text-left text-xs text-muted-foreground">
            <tr>
              <th className="p-3">Data</th>
              <th className="p-3">Paciente</th>
              {gestor && <th className="p-3">Profissional</th>}
              <th className="p-3">Status</th>
              <th className="p-3 text-right">Valor (R$)</th>
              <th className="p-3 text-right">Repasse %</th>
              <th className="p-3 text-right">Repasse</th>
              <th className="p-3 text-center">Pago pelo paciente</th>
              <th className="p-3 text-center">Repasse pago</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtradas.length === 0 && (
              <tr>
                <td colSpan={9} className="p-8 text-center text-muted-foreground">
                  Nenhum atendimento no período.
                </td>
              </tr>
            )}
            {filtradas.map((l) => {
              const fin = l.fin!;
              return (
                <tr key={l.id}>
                  <td className="whitespace-nowrap p-3">
                    {fmtData(l.inicio, "dd/MM")} <span className="text-muted-foreground">{fmtHora(l.inicio)}</span>
                  </td>
                  <td className="p-3">
                    <div className="font-medium">{l.paciente?.nome}</div>
                    <div className="text-xs text-muted-foreground">{l.especialidade?.nome}</div>
                  </td>
                  {gestor && <td className="p-3">{l.profissional?.nome}</td>}
                  <td className="p-3">
                    <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", STATUS_AGENDA[l.status].className)}>
                      {STATUS_AGENDA[l.status].label}
                    </span>
                  </td>
                  <td className="p-3 text-right">
                    {!fin.cobrar ? (
                      <span className="text-xs text-muted-foreground">Não cobrada</span>
                    ) : gestor ? (
                      <CampoNumero rotulo="Valor da sessão" valor={Number(fin.valor)} onSalvar={(v) => atualizar(l.id, { valor: v })} />
                    ) : (
                      formatarMoeda(fin.valor)
                    )}
                  </td>
                  <td className="p-3 text-right">
                    {gestor ? (
                      <CampoNumero rotulo="Repasse (%)" percentual valor={Number(fin.percentual_repasse)} onSalvar={(v) => atualizar(l.id, { percentual_repasse: v })} />
                    ) : (
                      `${Number(fin.percentual_repasse)}%`
                    )}
                  </td>
                  <td className="whitespace-nowrap p-3 text-right font-medium">
                    {formatarMoeda(repasseDevido(fin))}
                    {l.status === "falta_cobrada" && (
                      <label className="mt-1 flex items-center justify-end gap-1.5 text-xs font-normal text-muted-foreground">
                        {fin.repassar ? "com repasse" : "sem repasse"}
                        {gestor && <Switch className="scale-75" checked={fin.repassar} onCheckedChange={(v) => atualizar(l.id, { repassar: v })} aria-label="Repasse nesta falta" />}
                      </label>
                    )}
                    {!fin.cobrar && <div className="text-xs font-normal text-muted-foreground">sem repasse</div>}
                  </td>
                  <td className="p-3 text-center">
                    <Switch
                      checked={fin.pagamento_status === "pago"}
                      disabled={!gestor}
                      onCheckedChange={(v) => atualizar(l.id, { pagamento_status: v ? "pago" : "pendente" })}
                    />
                  </td>
                  <td className="p-3 text-center">
                    <Switch checked={fin.repasse_pago} disabled={!gestor} onCheckedChange={(v) => atualizar(l.id, { repasse_pago: v })} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {gestor && (
        <p className="mt-3 text-xs text-muted-foreground">
          O valor de cada sessão vem do convênio do paciente (tabela abaixo) e o percentual, do repasse do profissional (definido em Equipe). Os dois podem ser ajustados em cada sessão.
          Sessões finalizadas e faltas não justificadas são cobradas; faltas justificadas e do terapeuta não geram cobrança nem repasse. Na falta cobrada, o repasse segue o que foi marcado na agenda e pode ser trocado aqui.
        </p>
      )}
      {gestor && <TabelaConvenios />}
    </div>
  );
}

/** Campo de valor (R$) ou percentual editável na tabela; aceita vírgula e volta ao valor anterior se for inválido. */
function CampoNumero({
  valor,
  percentual,
  rotulo,
  onSalvar,
}: {
  valor: number;
  percentual?: boolean;
  rotulo: string;
  onSalvar: (texto: string) => Promise<boolean>;
}) {
  const mostrar = (n: number) => (percentual ? String(n).replace(".", ",") : valorParaCampo(n));
  return (
    <Input
      key={valor}
      inputMode="decimal"
      defaultValue={mostrar(valor)}
      aria-label={rotulo}
      className="ml-auto h-8 w-24 text-right"
      onBlur={async (e) => {
        const campo = e.target;
        if (lerValorReais(campo.value.replace("%", "")) === valor) return void (campo.value = mostrar(valor));
        if (!(await onSalvar(campo.value))) campo.value = mostrar(valor);
      }}
      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
    />
  );
}
