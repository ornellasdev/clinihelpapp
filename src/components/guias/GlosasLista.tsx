import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { conveniosQuery, glosasQuery, type Glosa } from "@/lib/queries";
import { exigeGuia, STATUS_GLOSA, resumoGlosas, rotuloMotivo, type StatusGlosa } from "@/lib/guias";
import { formatarMoeda } from "@/lib/financeiro";
import { erroAmigavel, fmtData } from "@/lib/ui-helpers";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

const TODOS = "todos";

export function GlosasLista({ onEditar }: { onEditar: (g: Glosa) => void }) {
  const qc = useQueryClient();
  const { data: glosas } = useSuspenseQuery(glosasQuery);
  const { data: convenios } = useSuspenseQuery(conveniosQuery);
  const [status, setStatus] = useState<string>("abertas");
  const [convenio, setConvenio] = useState(TODOS);
  const [excluir, setExcluir] = useState<Glosa | null>(null);

  const resumo = useMemo(() => resumoGlosas(glosas), [glosas]);
  const filtradas = glosas.filter(
    (g) =>
      (convenio === TODOS || g.convenio_id === convenio) &&
      (status === TODOS || (status === "abertas" ? g.status === "identificada" || g.status === "em_recurso" : g.status === status)),
  );

  async function remover(g: Glosa) {
    const { error } = await supabase.from("glosas").delete().eq("id", g.id);
    setExcluir(null);
    if (error) return void toast.error(erroAmigavel(error.message));
    toast.success("Glosa excluída.");
    qc.invalidateQueries({ queryKey: ["glosas"] });
  }

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Total label="Retido em glosa" valor={resumo.total.retido} sub="Identificadas + em recurso" tom="alerta" />
        <Total label="Recuperado" valor={resumo.total.recuperado} tom="ok" />
        <Total label="Perda definitiva" valor={resumo.total.perda} tom="perigo" />
        <Total label="Total glosado" valor={resumo.total.total} />
      </div>

      {resumo.porConvenio.length > 0 && (
        <div className="overflow-x-auto rounded-2xl border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-surface text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-3 py-2.5">Convênio</th>
                <th className="px-3 py-2.5 text-right">Retido</th>
                <th className="px-3 py-2.5 text-right">Recuperado</th>
                <th className="px-3 py-2.5 text-right">Perda</th>
              </tr>
            </thead>
            <tbody>
              {resumo.porConvenio.map((c) => (
                <tr key={c.nome} className="border-t">
                  <td className="px-3 py-2 font-medium">{c.nome}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-warning-foreground">{formatarMoeda(c.retido)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-success">{formatarMoeda(c.recuperado)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-destructive">{formatarMoeda(c.perda)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-48" aria-label="Status do recurso">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="abertas">Em aberto</SelectItem>
            <SelectItem value={TODOS}>Todos os status</SelectItem>
            {(Object.keys(STATUS_GLOSA) as StatusGlosa[]).map((s) => (
              <SelectItem key={s} value={s}>
                {STATUS_GLOSA[s].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={convenio} onValueChange={setConvenio}>
          <SelectTrigger className="w-48" aria-label="Convênio">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todos os convênios</SelectItem>
            {convenios
              .filter((c) => exigeGuia(c.tipo))
              .map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.nome}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </div>

      {filtradas.length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          {glosas.length === 0 ? "Nenhuma glosa registrada. Use “Glosar” no faturamento ou nas guias." : "Nenhuma glosa com esses filtros."}
        </div>
      ) : (
        <ul className="grid gap-2">
          {filtradas.map((g) => {
            const st = STATUS_GLOSA[g.status as StatusGlosa];
            return (
              <li key={g.id} className="flex items-start gap-3 rounded-xl border bg-card p-3">
                <button onClick={() => onEditar(g)} className="min-w-0 flex-1 text-left">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{g.paciente?.nome}</span>
                    <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", st?.className)}>{st?.label ?? g.status}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {g.convenio?.nome}
                    {g.guia ? ` · Guia ${g.guia.codigo_guia}` : ""}
                    {g.agendamento ? ` · Sessão ${fmtData(g.agendamento.inicio)}` : ""} · glosada em {fmtData(g.data_glosa)}
                  </div>
                  <div className="mt-0.5 text-xs">
                    {rotuloMotivo(g.motivo)}
                    {g.motivo_detalhe ? ` — ${g.motivo_detalhe}` : ""}
                  </div>
                </button>
                <div className="shrink-0 text-right">
                  <div className="font-semibold tabular-nums">{formatarMoeda(Number(g.valor))}</div>
                  <Button variant="ghost" size="icon" className="size-8" aria-label="Excluir glosa" onClick={() => setExcluir(g)}>
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <AlertDialog open={!!excluir} onOpenChange={(v) => !v && setExcluir(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir esta glosa?</AlertDialogTitle>
            <AlertDialogDescription>Use só para lançamentos feitos por engano. Para glosas resolvidas, mude o status para “Recuperada” ou “Perda definitiva”.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={() => excluir && remover(excluir)}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Total({ label, valor, sub, tom }: { label: string; valor: number; sub?: string; tom?: "alerta" | "ok" | "perigo" }) {
  return (
    <div className="rounded-2xl border bg-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div
        className={cn(
          "mt-1 font-display text-xl font-semibold tabular-nums",
          tom === "alerta" && "text-warning-foreground",
          tom === "ok" && "text-success",
          tom === "perigo" && "text-destructive",
        )}
      >
        {formatarMoeda(valor)}
      </div>
      {sub && <div className="text-[11px] text-muted-foreground">{sub}</div>}
    </div>
  );
}
