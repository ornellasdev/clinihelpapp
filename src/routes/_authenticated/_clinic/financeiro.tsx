import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { addMonths, format, parseISO, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { equipeQuery, financeiroQuery } from "@/lib/queries";
import { useMe } from "@/hooks/use-me";
import { podeGerirFinanceiro } from "@/lib/permissions";
import { calcularRepasse, formatarMoeda } from "@/lib/financeiro";
import { STATUS_AGENDA, erroAmigavel, fmtData, fmtHora } from "@/lib/ui-helpers";
import { PageHeader } from "@/components/PageHeader";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

const mesAtual = () => format(new Date(), "yyyy-MM");

export const Route = createFileRoute("/_authenticated/_clinic/financeiro")({
  validateSearch: z.object({
    mes: z.string().regex(/^\d{4}-\d{2}$/).optional(),
    prof: z.string().optional(),
    status: z.string().optional(),
  }),
  loaderDeps: ({ search }) => ({ mes: search.mes ?? mesAtual() }),
  loader: ({ context, deps }) => {
    const ini = startOfMonth(parseISO(`${deps.mes}-01`));
    return Promise.all([
      context.queryClient.ensureQueryData(financeiroQuery(ini.toISOString(), addMonths(ini, 1).toISOString())),
      context.queryClient.ensureQueryData(equipeQuery),
    ]);
  },
  head: () => ({ meta: [{ title: "Financeiro — Florescer" }] }),
  component: FinanceiroPage,
});

function FinanceiroPage() {
  const me = useMe();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const qc = useQueryClient();
  const mes = search.mes ?? mesAtual();
  const status = search.status ?? "realizado";
  const ini = startOfMonth(parseISO(`${mes}-01`));
  const q = financeiroQuery(ini.toISOString(), addMonths(ini, 1).toISOString());
  const { data: linhas } = useSuspenseQuery(q);
  const { data: equipe } = useSuspenseQuery(equipeQuery);
  const gestor = podeGerirFinanceiro(me.papeis);

  const filtradas = linhas.filter(
    (l) => (status === "todos" ? l.status !== "cancelado" : l.status === status) && (!search.prof || l.profissional_id === search.prof),
  );

  const totais = useMemo(() => {
    const valor = filtradas.reduce((s, l) => s + Number(l.fin?.valor ?? 0), 0);
    const repasse = filtradas.reduce((s, l) => s + Number(l.fin?.valor_repasse ?? 0), 0);
    const recebido = filtradas.filter((l) => l.fin?.pagamento_status === "pago").reduce((s, l) => s + Number(l.fin?.valor ?? 0), 0);
    const repassePago = filtradas.filter((l) => l.fin?.repasse_pago).reduce((s, l) => s + Number(l.fin?.valor_repasse ?? 0), 0);
    return { valor, repasse, recebido, repassePago, liquido: valor - repasse };
  }, [filtradas]);

  const porProf = useMemo(() => {
    const m = new Map<string, { nome: string; n: number; valor: number; repasse: number }>();
    for (const l of filtradas) {
      const it = m.get(l.profissional_id) ?? { nome: l.profissional?.nome ?? "", n: 0, valor: 0, repasse: 0 };
      it.n++;
      it.valor += Number(l.fin?.valor ?? 0);
      it.repasse += Number(l.fin?.valor_repasse ?? 0);
      m.set(l.profissional_id, it);
    }
    return [...m.values()].sort((a, b) => a.nome.localeCompare(b.nome));
  }, [filtradas]);

  async function atualizar(id: string, patch: { valor?: number; percentual_repasse?: number; pagamento_status?: string; repasse_pago?: boolean }) {
    const { error } = await supabase.from("atendimento_financeiro").update(patch).eq("agendamento_id", id);
    if (error) { toast.error(erroAmigavel(error.message)); return; }
    qc.invalidateQueries({ queryKey: q.queryKey });
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

  return (
    <div>
      <PageHeader
        titulo={gestor ? "Financeiro" : "Meus repasses"}
        descricao={format(ini, "MMMM 'de' yyyy", { locale: ptBR })}
      />

      <div className="mb-5 flex flex-wrap gap-2">
        <Input type="month" value={mes} onChange={(e) => e.target.value && navigate({ search: (s) => ({ ...s, mes: e.target.value }) })} className="w-auto" />
        <Select value={status} onValueChange={(v) => navigate({ search: (s) => ({ ...s, status: v }) })}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="realizado">Realizados</SelectItem>
            <SelectItem value="falta">Faltas</SelectItem>
            <SelectItem value="agendado">Agendados</SelectItem>
            <SelectItem value="confirmado">Confirmados</SelectItem>
            <SelectItem value="todos">Todos (exceto cancelados)</SelectItem>
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
                    {gestor ? (
                      <CampoNumero valor={Number(fin.valor)} onSalvar={(v) => atualizar(l.id, { valor: v })} />
                    ) : (
                      formatarMoeda(fin.valor)
                    )}
                  </td>
                  <td className="p-3 text-right">
                    {gestor ? (
                      <CampoNumero valor={Number(fin.percentual_repasse)} max={100} onSalvar={(v) => atualizar(l.id, { percentual_repasse: v })} />
                    ) : (
                      `${Number(fin.percentual_repasse)}%`
                    )}
                  </td>
                  <td className="whitespace-nowrap p-3 text-right font-medium">
                    {formatarMoeda(calcularRepasse(Number(fin.valor), Number(fin.percentual_repasse)))}
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
          Valor e percentual começam com o padrão do profissional (definido em Equipe) e podem ser ajustados em cada sessão.
        </p>
      )}
    </div>
  );
}

function CampoNumero({ valor, max, onSalvar }: { valor: number; max?: number; onSalvar: (v: number) => void }) {
  return (
    <Input
      key={valor}
      type="number"
      step="0.01"
      min={0}
      max={max}
      defaultValue={valor}
      className="ml-auto h-8 w-24 text-right"
      onBlur={(e) => {
        const v = Number(e.target.value);
        if (Number.isFinite(v) && v !== valor && v >= 0 && (!max || v <= max)) onSalvar(v);
      }}
      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
    />
  );
}
