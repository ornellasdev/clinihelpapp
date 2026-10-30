import { useState } from "react";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Loader2, Lock, Pencil, Plus, Target, TrendingDown, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { especialidadesQuery, metasQuery, progressoMetasQuery } from "@/lib/queries";
import { useMe } from "@/hooks/use-me";
import { podeVerProntuario } from "@/lib/permissions";
import { NIVEIS, resumoDaMeta, rotuloNivel, serieDaMeta, STATUS_META, type StatusMeta } from "@/lib/plano-terapeutico";
import { corEsp, erroAmigavel, fmtData } from "@/lib/ui-helpers";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type Meta = Tables<"plano_metas">;
const CORES = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

export function PlanoTerapeuticoTab({ pacienteId }: { pacienteId: string }) {
  const me = useMe();
  const { data: especialidades } = useSuspenseQuery(especialidadesQuery);
  const { data: metas } = useSuspenseQuery(metasQuery(pacienteId));
  const { data: progresso } = useSuspenseQuery(progressoMetasQuery(pacienteId));
  const [editar, setEditar] = useState<{ meta?: Meta; especialidadeId: string } | null>(null);

  const visiveis = especialidades.filter((e) => podeVerProntuario(me.papeis, me.especialidades, e.id));
  const podeGerir = (espId: string) => me.papeis.includes("master") || me.especialidades.includes(espId);

  if (visiveis.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed p-10 text-center">
        <Lock className="mx-auto size-8 text-muted-foreground" />
        <p className="mt-3 font-medium">Plano terapêutico restrito</p>
        <p className="mt-1 text-sm text-muted-foreground">Apenas profissionais da especialidade e o acesso master podem ver as metas.</p>
      </div>
    );
  }

  const comMetas = visiveis.filter((e) => metas.some((m) => m.especialidade_id === e.id) || podeGerir(e.id));

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Em cada evolução, o profissional marca o nível alcançado em cada meta (1 = {NIVEIS[0].label.toLowerCase()} · 5 ={" "}
        {NIVEIS[4].label.toLowerCase()}). O gráfico mostra a evolução ao longo das sessões.
      </p>
      {comMetas.length === 0 && (
        <div className="rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">Nenhuma meta cadastrada ainda.</div>
      )}
      {comMetas.map((esp) => {
        const doEsp = metas.filter((m) => m.especialidade_id === esp.id);
        const series = doEsp.map((m, i) => ({ m, cor: CORES[i % CORES.length]!, pts: serieDaMeta(m.id, progresso) }));
        const datas = [...new Set(series.flatMap((s) => s.pts.map((p) => p.data)))].sort();
        const dadosGrafico = datas.map((d) => ({
          data: d,
          ...Object.fromEntries(series.map((s) => [s.m.id, s.pts.find((p) => p.data === d)?.nivel ?? null])),
        }));
        return (
          <section key={esp.id} className="rounded-2xl border bg-card p-4 sm:p-5">
            <header className="mb-4 flex flex-wrap items-center gap-2">
              <span className={cn("rounded-full border px-2.5 py-0.5 text-sm font-medium", corEsp(esp.cor))}>{esp.nome}</span>
              <span className="text-sm text-muted-foreground">{doEsp.length} meta(s)</span>
              {podeGerir(esp.id) && (
                <Button size="sm" variant="secondary" className="ml-auto" onClick={() => setEditar({ especialidadeId: esp.id })}>
                  <Plus /> Nova meta
                </Button>
              )}
            </header>

            {dadosGrafico.length > 0 && (
              <div className="mb-4 h-56 w-full sm:h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dadosGrafico} margin={{ top: 8, right: 12, left: -24, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="data" tickFormatter={(d: string) => fmtData(d, "dd/MM")} fontSize={11} stroke="var(--muted-foreground)" />
                    <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} fontSize={11} stroke="var(--muted-foreground)" />
                    <Tooltip
                      labelFormatter={(d) => fmtData(String(d), "dd/MM/yyyy")}
                      formatter={(v, id) => [`${v} · ${rotuloNivel(Math.round(Number(v)))}`, doEsp.find((m) => m.id === id)?.titulo ?? ""]}
                      wrapperStyle={{ maxWidth: "80%" }}
                      contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12, whiteSpace: "normal" }}
                    />
                    {series.map((s) => (
                      <Line key={s.m.id} dataKey={s.m.id} stroke={s.cor} strokeWidth={2.5} dot={{ r: 3 }} connectNulls type="monotone" />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            <div className="space-y-2">
              {series.map((s) => {
                const r = resumoDaMeta(s.m.id, progresso);
                return (
                  <div key={s.m.id} className="flex items-start gap-3 rounded-xl border p-3">
                    <span className="mt-1.5 size-3 shrink-0 rounded-full" style={{ background: s.cor }} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{s.m.titulo}</span>
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-xs",
                            s.m.status === "alcancada" ? "bg-success/15 text-success" : s.m.status === "pausada" ? "bg-muted text-muted-foreground" : "bg-secondary text-secondary-foreground",
                          )}
                        >
                          {STATUS_META[s.m.status as StatusMeta]}
                        </span>
                      </div>
                      {s.m.descricao && <p className="mt-0.5 text-sm text-muted-foreground">{s.m.descricao}</p>}
                      <p className="mt-1 text-xs text-muted-foreground">
                        {r.sessoes === 0
                          ? "Ainda sem registro nas evoluções"
                          : `${r.sessoes} sessão(ões) · de ${r.inicial} para ${r.atual}`}
                        {s.m.prazo && ` · prazo ${fmtData(s.m.prazo)}`}
                        {r.avanco > 0 && <TrendingUp className="ml-1 inline size-3.5 text-success" />}
                        {r.avanco < 0 && <TrendingDown className="ml-1 inline size-3.5 text-destructive" />}
                      </p>
                    </div>
                    {podeGerir(esp.id) && (
                      <Button size="icon" variant="ghost" aria-label={`Editar ${s.m.titulo}`} onClick={() => setEditar({ meta: s.m, especialidadeId: esp.id })}>
                        <Pencil />
                      </Button>
                    )}
                  </div>
                );
              })}
              {doEsp.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma meta para esta especialidade.</p>}
            </div>
          </section>
        );
      })}

      {editar && <MetaDialog pacienteId={pacienteId} {...editar} onClose={() => setEditar(null)} />}
    </div>
  );
}

function MetaDialog({
  pacienteId,
  especialidadeId,
  meta,
  onClose,
}: {
  pacienteId: string;
  especialidadeId: string;
  meta?: Meta | undefined;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [titulo, setTitulo] = useState(meta?.titulo ?? "");
  const [descricao, setDescricao] = useState(meta?.descricao ?? "");
  const [status, setStatus] = useState<StatusMeta>((meta?.status as StatusMeta) ?? "ativa");
  const [prazo, setPrazo] = useState(meta?.prazo ?? "");
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    if (!titulo.trim()) { toast.error("Escreva a meta."); return; }
    setSalvando(true);
    const payload = { titulo: titulo.trim(), descricao: descricao.trim() || null, status, prazo: prazo || null };
    const { error } = meta
      ? await supabase.from("plano_metas").update(payload).eq("id", meta.id)
      : await supabase.from("plano_metas").insert({ ...payload, paciente_id: pacienteId, especialidade_id: especialidadeId });
    setSalvando(false);
    if (error) { toast.error(erroAmigavel(error.message)); return; }
    toast.success("Meta salva.");
    qc.invalidateQueries({ queryKey: ["metas", pacienteId] });
    onClose();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="size-5 text-primary" /> {meta ? "Editar meta" : "Nova meta"}
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label>Meta</Label>
            <Input value={titulo} maxLength={200} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Pedir objetos usando frases de 2 palavras" />
          </div>
          <div className="grid gap-1.5">
            <Label>Detalhes (opcional)</Label>
            <Textarea value={descricao} maxLength={1000} onChange={(e) => setDescricao(e.target.value)} placeholder="Como será medido, contexto, critério de alcance..." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Situação</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as StatusMeta)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_META).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Prazo (opcional)</Label>
              <Input type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={salvar} disabled={salvando} className="w-full sm:w-auto">
            {salvando && <Loader2 className="animate-spin" />} Salvar meta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
