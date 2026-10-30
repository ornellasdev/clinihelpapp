import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { format } from "date-fns";
import { FileCheck2, MoreVertical, Paperclip, Pencil, Receipt, Search, Trash2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { conveniosQuery, guiasQuery, guiasUsoQuery, type Guia } from "@/lib/queries";
import { useMe } from "@/hooks/use-me";
import { podeGerirGlosas, podeRemoverGuia } from "@/lib/permissions";
import { exigeGuia, SITUACAO_GUIA, saldoGuia, situacaoGuia, type SituacaoGuia } from "@/lib/guias";
import { erroAmigavel, fmtData } from "@/lib/ui-helpers";
import { abrirAnexoGuia, BUCKET_GUIAS } from "@/components/guias/GuiaDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

const TODAS = "todas";
const ABERTAS: SituacaoGuia[] = ["solicitada", "autorizada", "em_uso"];

export function GuiasLista({ onEditar, onGlosar }: { onEditar: (g: Guia) => void; onGlosar: (g: Guia) => void }) {
  const me = useMe();
  const qc = useQueryClient();
  const { data: guias } = useSuspenseQuery(guiasQuery);
  const { data: usoLinhas } = useSuspenseQuery(guiasUsoQuery);
  const { data: convenios } = useSuspenseQuery(conveniosQuery);
  const [busca, setBusca] = useState("");
  const [situacao, setSituacao] = useState<string>("abertas");
  const [convenio, setConvenio] = useState(TODAS);
  const [excluir, setExcluir] = useState<Guia | null>(null);
  const hoje = format(new Date(), "yyyy-MM-dd");

  const linhas = useMemo(() => {
    const uso = new Map(usoLinhas.map((u) => [u.guia_id ?? "", u]));
    return guias.map((g) => {
      const u = uso.get(g.id);
      const usadas = u?.usadas ?? 0;
      return { g, usadas, reservadas: u?.reservadas ?? 0, saldo: saldoGuia(g, usadas), situacao: situacaoGuia(g, usadas, hoje) };
    });
  }, [guias, usoLinhas, hoje]);

  const filtradas = linhas.filter((l) => {
    const t = busca.trim().toLowerCase();
    if (t && !`${l.g.paciente?.nome} ${l.g.codigo_guia} ${l.g.codigo_tuss} ${l.g.codigo_faturamento}`.toLowerCase().includes(t)) return false;
    if (convenio !== TODAS && l.g.convenio_id !== convenio) return false;
    if (situacao === "abertas") return ABERTAS.includes(l.situacao);
    return situacao === TODAS || l.situacao === situacao;
  });

  async function faturar(g: Guia) {
    const { error } = await supabase.from("guias_convenio").update({ status: "faturada" }).eq("id", g.id);
    if (error) return void toast.error(erroAmigavel(error.message));
    toast.success(`Guia ${g.codigo_guia} marcada como faturada.`);
    qc.invalidateQueries({ queryKey: ["guias"] });
  }

  async function remover(g: Guia) {
    const { error } = await supabase.from("guias_convenio").delete().eq("id", g.id);
    if (error) return void toast.error(erroAmigavel(error.message));
    if (g.anexo_path) await supabase.storage.from(BUCKET_GUIAS).remove([g.anexo_path]);
    toast.success("Guia excluída.");
    qc.invalidateQueries({ queryKey: ["guias"] });
    qc.invalidateQueries({ queryKey: ["agenda"] });
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Paciente ou código" className="pl-9" aria-label="Buscar guia" />
        </div>
        <Select value={situacao} onValueChange={setSituacao}>
          <SelectTrigger className="w-44" aria-label="Situação">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="abertas">Em aberto</SelectItem>
            <SelectItem value={TODAS}>Todas as situações</SelectItem>
            {(Object.keys(SITUACAO_GUIA) as SituacaoGuia[]).map((s) => (
              <SelectItem key={s} value={s}>
                {SITUACAO_GUIA[s].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={convenio} onValueChange={setConvenio}>
          <SelectTrigger className="w-48" aria-label="Convênio">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODAS}>Todos os convênios</SelectItem>
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
          {guias.length === 0 ? "Nenhuma guia cadastrada ainda. Use “Nova guia” para começar." : "Nenhuma guia com esses filtros."}
        </div>
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {filtradas.map(({ g, usadas, reservadas, saldo, situacao: sit }) => {
            const total = g.sessoes_autorizadas ?? 0;
            const pct = total > 0 ? Math.min(100, (usadas / total) * 100) : 0;
            return (
              <li key={g.id} className="rounded-2xl border bg-card p-4">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <button onClick={() => onEditar(g)} className="truncate text-left font-medium hover:underline">
                        {g.paciente?.nome}
                      </button>
                      <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", SITUACAO_GUIA[sit].className)}>{SITUACAO_GUIA[sit].label}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {g.convenio?.nome} · {g.especialidade?.nome}
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" aria-label="Ações da guia">
                        <MoreVertical />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onEditar(g)}>
                        <Pencil /> Editar
                      </DropdownMenuItem>
                      {g.anexo_path && (
                        <DropdownMenuItem onClick={() => abrirAnexoGuia(g.anexo_path!)}>
                          <Paperclip /> Abrir anexo
                        </DropdownMenuItem>
                      )}
                      {g.status === "autorizada" && (
                        <DropdownMenuItem onClick={() => faturar(g)}>
                          <Receipt /> Marcar como faturada
                        </DropdownMenuItem>
                      )}
                      {podeGerirGlosas(me.papeis) && (
                        <DropdownMenuItem onClick={() => onGlosar(g)}>
                          <TriangleAlert /> Registrar glosa
                        </DropdownMenuItem>
                      )}
                      {podeRemoverGuia(me.papeis) && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive" onClick={() => setExcluir(g)}>
                            <Trash2 /> Excluir
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <dl className="mt-3 grid grid-cols-3 gap-2 rounded-xl bg-surface p-2.5 text-xs">
                  <Codigo label="TUSS" valor={g.codigo_tuss} />
                  <Codigo label="Guia" valor={g.codigo_guia} />
                  <Codigo label="Faturamento" valor={g.codigo_faturamento} />
                </dl>

                {g.sessoes_autorizadas != null ? (
                  <div className="mt-3">
                    <div className="mb-1 flex items-baseline justify-between text-xs">
                      <span className={cn("font-medium", saldo <= 2 && ABERTAS.includes(sit) && "text-warning-foreground")}>
                        Restam {saldo} de {total} sessões
                      </span>
                      <span className="text-muted-foreground">
                        {usadas} usadas{reservadas ? ` · ${reservadas} agendadas` : ""}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                ) : (
                  <p className="mt-3 text-xs text-muted-foreground">{g.sessoes_solicitadas} sessões solicitadas · aguardando autorização</p>
                )}

                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span>Solicitada {fmtData(g.data_solicitacao)}</span>
                  {g.data_liberacao && <span>Liberada {fmtData(g.data_liberacao)}</span>}
                  {g.validade && <span className={cn(sit === "vencida" && "font-medium text-destructive")}>Validade {fmtData(g.validade)}</span>}
                  {g.sessoes_autorizadas != null && g.sessoes_autorizadas < g.sessoes_solicitadas && (
                    <span>
                      Pedidas {g.sessoes_solicitadas}, autorizadas {g.sessoes_autorizadas}
                    </span>
                  )}
                  {g.anexo_path && (
                    <button onClick={() => abrirAnexoGuia(g.anexo_path!)} className="flex items-center gap-1 text-primary hover:underline">
                      <FileCheck2 className="size-3.5" /> Anexo
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <AlertDialog open={!!excluir} onOpenChange={(v) => !v && setExcluir(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir a guia {excluir?.codigo_guia}?</AlertDialogTitle>
            <AlertDialogDescription>As sessões vinculadas a ela ficam sem guia. Para guias negadas ou desistências, prefira mudar a situação para “Cancelada”.</AlertDialogDescription>
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

function Codigo({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="truncate font-mono text-[13px]" title={valor}>
        {valor}
      </dd>
    </div>
  );
}
