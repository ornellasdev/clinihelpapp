import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { addMonths, format, parseISO, startOfMonth } from "date-fns";
import { AlertTriangle, Download, Receipt, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { conveniosQuery, faturamentoGuiasQuery, type LinhaFaturamento } from "@/lib/queries";
import { useMe } from "@/hooks/use-me";
import { podeGerirGlosas } from "@/lib/permissions";
import { exigeGuia, STATUS_LIBERACAO, type StatusLiberacao } from "@/lib/guias";
import { formatarMoeda } from "@/lib/financeiro";
import { exportarCsvTabela } from "@/lib/exportar-financeiro";
import { erroAmigavel, fmtData, fmtHora } from "@/lib/ui-helpers";
import type { GlosaPadrao } from "@/components/guias/GlosaDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

export const intervaloMes = (mes: string) => {
  const ini = startOfMonth(parseISO(`${mes}-01`));
  return [ini.toISOString(), addMonths(ini, 1).toISOString()] as const;
};

const TODOS = "todos";

export function FaturamentoLote({
  mes,
  convenio,
  onFiltro,
  onGlosar,
}: {
  mes: string;
  convenio: string | undefined;
  onFiltro: (f: { mes?: string; convenio?: string | undefined }) => void;
  onGlosar: (p: GlosaPadrao) => void;
}) {
  const me = useMe();
  const qc = useQueryClient();
  const [a, b] = intervaloMes(mes);
  const { data: sessoes } = useSuspenseQuery(faturamentoGuiasQuery(a, b));
  const { data: convenios } = useSuspenseQuery(conveniosQuery);
  const [confirmar, setConfirmar] = useState(false);
  const veValor = podeGerirGlosas(me.papeis);

  const linhas = useMemo(() => {
    const porId = new Map(convenios.map((c) => [c.id, c]));
    return sessoes
      .map((s) => {
        const guia = s.liberacao?.guia ?? null;
        const conv = porId.get(guia?.convenio_id ?? s.paciente?.convenio_id ?? "");
        return { s, guia, conv };
      })
      .filter((l) => exigeGuia(l.conv?.tipo) && (!convenio || l.conv?.id === convenio));
  }, [sessoes, convenios, convenio]);

  const semGuia = linhas.filter((l) => !l.guia).length;
  const guiasAFaturar = [...new Set(linhas.filter((l) => l.guia?.status === "autorizada").map((l) => l.guia!.id))];
  const total = linhas.reduce((t, l) => t + Number(l.s.fin?.valor ?? 0), 0);

  function exportar() {
    const cab = ["Data", "Hora", "Paciente", "Carteirinha", "Convênio", "Especialidade", "Profissional", "Registro", "Código TUSS", "Código da guia", "Código de faturamento", "Token / senha", "Liberação"];
    if (veValor) cab.push("Valor (R$)");
    const corpo = linhas.map(({ s, guia, conv }) => {
      const l: (string | number)[] = [
        fmtData(s.inicio),
        fmtHora(s.inicio),
        s.paciente?.nome ?? "",
        s.paciente?.carteirinha ?? "",
        conv?.nome ?? "",
        s.especialidade?.nome ?? "",
        s.profissional?.nome ?? "",
        [s.profissional?.conselho, s.profissional?.registro_profissional].filter(Boolean).join(" "),
        guia?.codigo_tuss ?? "",
        guia?.codigo_guia ?? "SEM GUIA",
        guia?.codigo_faturamento ?? "",
        s.liberacao?.token ?? "",
        STATUS_LIBERACAO[(s.liberacao?.status ?? "pendente") as StatusLiberacao].curto,
      ];
      if (veValor) l.push(Number(s.fin?.valor ?? 0));
      return l;
    });
    const nomeConv = convenio ? (convenios.find((c) => c.id === convenio)?.nome ?? "convenio") : "todos";
    exportarCsvTabela(cab, corpo, `faturamento-${nomeConv.toLowerCase().replace(/\W+/g, "-")}-${mes}`);
  }

  async function faturarGuias() {
    const { error } = await supabase.from("guias_convenio").update({ status: "faturada" }).in("id", guiasAFaturar);
    setConfirmar(false);
    if (error) return void toast.error(erroAmigavel(error.message));
    toast.success(`${guiasAFaturar.length} ${guiasAFaturar.length === 1 ? "guia marcada" : "guias marcadas"} como faturada.`);
    qc.invalidateQueries({ queryKey: ["guias"] });
  }

  function glosar(l: (typeof linhas)[number]) {
    onGlosar({
      paciente_id: l.s.paciente_id,
      convenio_id: l.conv?.id ?? null,
      guia_id: l.guia?.id ?? null,
      agendamento_id: l.s.id,
      valor: l.s.fin?.valor != null ? Number(l.s.fin.valor) : null,
      referencia: `Sessão de ${fmtData(l.s.inicio)} ${fmtHora(l.s.inicio)} · ${l.s.paciente?.nome ?? ""}`,
    });
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input type="month" value={mes} aria-label="Mês" className="w-auto" onChange={(e) => e.target.value && onFiltro({ mes: e.target.value })} />
        <Select value={convenio ?? TODOS} onValueChange={(v) => onFiltro({ convenio: v === TODOS ? undefined : v })}>
          <SelectTrigger className="w-52" aria-label="Convênio">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todos os convênios</SelectItem>
            {convenios
              .filter((c) => c.tipo !== "particular")
              .map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.nome}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
        <div className="flex flex-wrap gap-2 sm:ml-auto">
          <Button variant="outline" onClick={exportar} disabled={!linhas.length}>
            <Download /> Exportar planilha
          </Button>
          {guiasAFaturar.length > 0 && (
            <Button onClick={() => setConfirmar(true)}>
              <Receipt /> Marcar {guiasAFaturar.length} {guiasAFaturar.length === 1 ? "guia" : "guias"} como faturada
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-x-6 gap-y-1 rounded-xl bg-surface px-4 py-3 text-sm">
        <span>
          <strong className="tabular-nums">{linhas.length}</strong> sessões realizadas
        </span>
        {veValor && (
          <span>
            Total <strong className="tabular-nums">{formatarMoeda(total)}</strong>
          </span>
        )}
        {semGuia > 0 && (
          <span className="flex items-center gap-1 font-medium text-destructive">
            <AlertTriangle className="size-4" /> {semGuia} sem guia vinculada
          </span>
        )}
      </div>

      {linhas.length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">Nenhuma sessão de convênio realizada neste período.</div>
      ) : (
        <>
          {/* Celular */}
          <ul className="grid gap-2 md:hidden">
            {linhas.map((l) => (
              <li key={l.s.id} className={cn("rounded-xl border bg-card p-3 text-sm", !l.guia && "border-destructive/40")}>
                <div className="flex justify-between gap-2">
                  <span className="font-medium">{l.s.paciente?.nome}</span>
                  <span className="text-xs text-muted-foreground">
                    {fmtData(l.s.inicio)} {fmtHora(l.s.inicio)}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {l.conv?.nome} · {l.s.profissional?.nome}
                </div>
                <div className="mt-1 font-mono text-xs">
                  {l.guia ? `TUSS ${l.guia.codigo_tuss} · Guia ${l.guia.codigo_guia} · Fat. ${l.guia.codigo_faturamento}` : <span className="text-destructive">Sem guia</span>}
                </div>
                {veValor && (
                  <div className="mt-2 flex items-center justify-between">
                    <span className="tabular-nums">{formatarMoeda(Number(l.s.fin?.valor ?? 0))}</span>
                    <Button variant="ghost" size="sm" onClick={() => glosar(l)}>
                      <TriangleAlert /> Glosar
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
          {/* Computador */}
          <div className="hidden overflow-x-auto rounded-2xl border bg-card md:block">
            <table className="w-full text-sm">
              <thead className="bg-surface text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-2.5">Data</th>
                  <th className="px-3 py-2.5">Paciente</th>
                  <th className="px-3 py-2.5">Profissional</th>
                  <th className="px-3 py-2.5">TUSS</th>
                  <th className="px-3 py-2.5">Guia</th>
                  <th className="px-3 py-2.5">Faturamento</th>
                  <th className="px-3 py-2.5">Token</th>
                  {veValor && <th className="px-3 py-2.5 text-right">Valor</th>}
                  {veValor && <th className="px-3 py-2.5" />}
                </tr>
              </thead>
              <tbody>
                {linhas.map((l) => (
                  <Linha key={l.s.id} l={l} veValor={veValor} onGlosar={() => glosar(l)} />
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <AlertDialog open={confirmar} onOpenChange={setConfirmar}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Marcar guias como faturadas?</AlertDialogTitle>
            <AlertDialogDescription>
              {guiasAFaturar.length} {guiasAFaturar.length === 1 ? "guia deste lote passa" : "guias deste lote passam"} para “Faturada”. Faça isso depois de lançar as sessões no portal da operadora.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={faturarGuias}>Marcar como faturadas</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Linha({
  l,
  veValor,
  onGlosar,
}: {
  l: { s: LinhaFaturamento; guia: NonNullable<LinhaFaturamento["liberacao"]>["guia"] | null; conv?: { nome: string } | undefined };
  veValor: boolean;
  onGlosar: () => void;
}) {
  return (
    <tr className={cn("border-t", !l.guia && "bg-destructive/5")}>
      <td className="whitespace-nowrap px-3 py-2 tabular-nums">
        {fmtData(l.s.inicio)} <span className="text-muted-foreground">{fmtHora(l.s.inicio)}</span>
      </td>
      <td className="px-3 py-2">
        <div className="font-medium">{l.s.paciente?.nome}</div>
        <div className="text-xs text-muted-foreground">
          {l.conv?.nome}
          {l.s.paciente?.carteirinha ? ` · ${l.s.paciente.carteirinha}` : ""}
        </div>
      </td>
      <td className="px-3 py-2">
        <div>{l.s.profissional?.nome}</div>
        <div className="text-xs text-muted-foreground">{l.s.especialidade?.nome}</div>
      </td>
      {l.guia ? (
        <>
          <td className="px-3 py-2 font-mono text-xs">{l.guia.codigo_tuss}</td>
          <td className="px-3 py-2 font-mono text-xs">{l.guia.codigo_guia}</td>
          <td className="px-3 py-2 font-mono text-xs">{l.guia.codigo_faturamento}</td>
        </>
      ) : (
        <td colSpan={3} className="px-3 py-2 text-xs font-medium text-destructive">
          Sem guia vinculada
        </td>
      )}
      <td className="px-3 py-2 font-mono text-xs">{l.s.liberacao?.token ?? "—"}</td>
      {veValor && <td className="px-3 py-2 text-right tabular-nums">{formatarMoeda(Number(l.s.fin?.valor ?? 0))}</td>}
      {veValor && (
        <td className="px-3 py-2 text-right">
          <Button variant="ghost" size="sm" onClick={onGlosar}>
            <TriangleAlert /> Glosar
          </Button>
        </td>
      )}
    </tr>
  );
}
