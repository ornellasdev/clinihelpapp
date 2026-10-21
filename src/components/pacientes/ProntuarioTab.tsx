import { useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarSearch, FilePenLine, Loader2, Lock, Pencil, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { agendaPacienteQuery, especialidadesQuery, evolucoesQuery } from "@/lib/queries";
import { useMe } from "@/hooks/use-me";
import { podeVerProntuario } from "@/lib/permissions";
import { corEsp, erroAmigavel, fmtData, fmtHora } from "@/lib/ui-helpers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type Evolucao = Tables<"evolucoes">;

export function ProntuarioTab({ pacienteId, agendamentoId }: { pacienteId: string; agendamentoId?: string | undefined }) {
  const me = useMe();
  const { data: especialidades } = useSuspenseQuery(especialidadesQuery);
  const { data: evolucoes } = useSuspenseQuery(evolucoesQuery(pacienteId));
  const [esp, setEsp] = useState("todas");
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const [form, setForm] = useState<{ editar?: Evolucao | undefined; agendamentoId?: string | undefined } | null>(
    agendamentoId ? { agendamentoId } : null,
  );

  const visiveis = especialidades.filter((e) => podeVerProntuario(me.papeis, me.especialidades, e.id));
  const espMap = useMemo(() => Object.fromEntries(especialidades.map((e) => [e.id, e])), [especialidades]);

  const porEsp = evolucoes.filter((e) => esp === "todas" || e.especialidade_id === esp);
  const filtradas = porEsp.filter((e) => (!de || e.data_atendimento >= de) && (!ate || e.data_atendimento <= ate));

  const sumario = useMemo(() => {
    const m = new Map<string, { data: string; total: number; esps: Set<string> }>();
    for (const e of porEsp) {
      const it = m.get(e.data_atendimento) ?? { data: e.data_atendimento, total: 0, esps: new Set() };
      it.total++;
      it.esps.add(e.especialidade_id);
      m.set(e.data_atendimento, it);
    }
    const lista = [...m.values()].sort((a, b) => b.data.localeCompare(a.data));
    const meses = new Map<string, typeof lista>();
    for (const it of lista) {
      const k = it.data.slice(0, 7);
      meses.set(k, [...(meses.get(k) ?? []), it]);
    }
    return [...meses.entries()];
  }, [porEsp]);

  if (visiveis.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed p-10 text-center">
        <Lock className="mx-auto size-8 text-muted-foreground" />
        <p className="mt-3 font-medium">Prontuário restrito</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Seu perfil não está vinculado a nenhuma especialidade. Apenas profissionais da especialidade e o acesso master
          podem ver as evoluções.
        </p>
      </div>
    );
  }

  const filtroData = de || ate;

  return (
    <div className="grid gap-5 lg:grid-cols-[260px_1fr]">
      {/* Sumário por data */}
      <aside className="order-2 lg:order-1">
        <div className="rounded-2xl border bg-card p-4 lg:sticky lg:top-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <CalendarSearch className="size-4 text-primary" /> Sumário por data
          </div>
          {sumario.length === 0 && <p className="text-sm text-muted-foreground">Sem registros.</p>}
          <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
            {sumario.map(([mes, dias]) => (
              <div key={mes}>
                <div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {format(parseISO(`${mes}-01`), "MMMM yyyy", { locale: ptBR })}
                </div>
                <div className="space-y-0.5">
                  {dias.map((d) => {
                    const ativo = de === d.data && ate === d.data;
                    return (
                      <button
                        key={d.data}
                        onClick={() => (ativo ? (setDe(""), setAte("")) : (setDe(d.data), setAte(d.data)))}
                        className={cn(
                          "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-muted",
                          ativo && "bg-secondary text-secondary-foreground",
                        )}
                      >
                        <span className="whitespace-nowrap font-medium">{fmtData(d.data, "dd/MM")} <span className="font-normal text-muted-foreground">{fmtData(d.data, "EEEEEE")}</span></span>
                        <span className="flex flex-1 gap-1">
                          {[...d.esps].map((id) => (
                            <span key={id} className={cn("size-2 rounded-full border", corEsp(espMap[id]?.cor))} />
                          ))}
                        </span>
                        <span className="text-xs text-muted-foreground">{d.total}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </aside>

      <div className="order-1 space-y-4 lg:order-2">
        <div className="flex flex-wrap items-end gap-2 rounded-2xl border bg-card p-3">
          <div className="grid min-w-40 flex-1 gap-1">
            <Label className="text-xs text-muted-foreground">Especialidade</Label>
            <Select value={esp} onValueChange={setEsp}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas que posso ver</SelectItem>
                {visiveis.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1">
            <Label className="text-xs text-muted-foreground">De</Label>
            <Input type="date" value={de} onChange={(e) => setDe(e.target.value)} />
          </div>
          <div className="grid gap-1">
            <Label className="text-xs text-muted-foreground">Até</Label>
            <Input type="date" value={ate} onChange={(e) => setAte(e.target.value)} />
          </div>
          {filtroData && (
            <Button variant="ghost" size="icon" onClick={() => (setDe(""), setAte(""))} aria-label="Limpar datas">
              <X />
            </Button>
          )}
          {me.especialidades.length > 0 && !form && (
            <Button onClick={() => setForm({})} className="w-full sm:ml-auto sm:w-auto">
              <Plus /> Nova evolução
            </Button>
          )}
        </div>

        {form && (
          <EvolucaoForm
            pacienteId={pacienteId}
            editar={form.editar}
            agendamentoId={form.agendamentoId}
            onClose={() => setForm(null)}
          />
        )}

        <div className="text-sm text-muted-foreground">
          {filtradas.length} evolução(ões){filtroData && " no período"}
        </div>

        {filtradas.map((e) => {
          const espe = espMap[e.especialidade_id];
          const editada = new Date(e.updated_at).getTime() - new Date(e.created_at).getTime() > 60_000;
          return (
            <article key={e.id} className="rounded-2xl border bg-card p-5">
              <header className="mb-3 flex flex-wrap items-center gap-2">
                <span className="font-display text-lg font-semibold">{fmtData(e.data_atendimento, "dd/MM/yyyy")}</span>
                <span className={cn("rounded-full border px-2.5 py-0.5 text-xs font-medium", corEsp(espe?.cor))}>{espe?.nome}</span>
                {e.profissional_id === me.id && (
                  <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setForm({ editar: e })}>
                    <Pencil /> Editar
                  </Button>
                )}
              </header>
              <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{e.conteudo}</p>
              <footer className="mt-4 border-t pt-3 text-sm">
                <div className="font-medium">{e.profissional_nome}</div>
                <div className="text-xs text-muted-foreground">
                  {e.profissional_registro ?? "Registro profissional não informado"} · registrado em{" "}
                  {fmtData(e.created_at, "dd/MM/yyyy 'às' HH:mm")}
                  {editada && ` · editado em ${fmtData(e.updated_at, "dd/MM/yyyy HH:mm")}`}
                </div>
              </footer>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function EvolucaoForm({
  pacienteId,
  editar,
  agendamentoId,
  onClose,
}: {
  pacienteId: string;
  editar?: Evolucao | undefined;
  agendamentoId?: string | undefined;
  onClose: () => void;
}) {
  const me = useMe();
  const qc = useQueryClient();
  const { data: especialidades } = useSuspenseQuery(especialidadesQuery);
  const { data: agenda = [] } = useQuery(agendaPacienteQuery(pacienteId));
  const minhas = especialidades.filter((e) => me.especialidades.includes(e.id));
  const meusAtend = agenda.filter((a) => a.profissional_id === me.id && a.status !== "cancelado");

  const [espId, setEspId] = useState(editar?.especialidade_id ?? (minhas.length === 1 ? minhas[0]!.id : ""));
  const [data, setData] = useState(editar?.data_atendimento ?? format(new Date(), "yyyy-MM-dd"));
  const [agId, setAgId] = useState(editar?.agendamento_id ?? agendamentoId ?? "");
  const [texto, setTexto] = useState(editar?.conteudo ?? "");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!agId || editar) return;
    const a = agenda.find((x) => x.id === agId);
    if (a) {
      setData(format(parseISO(a.inicio), "yyyy-MM-dd"));
      if (me.especialidades.includes(a.especialidade_id)) setEspId(a.especialidade_id);
    }
  }, [agId, agenda, editar, me.especialidades]);

  async function salvar() {
    if (!espId || !texto.trim()) { toast.error("Escolha a especialidade e escreva a evolução."); return; }
    setSalvando(true);
    const payload = { data_atendimento: data, conteudo: texto.trim(), agendamento_id: agId || null };
    const { error } = editar
      ? await supabase.from("evolucoes").update(payload).eq("id", editar.id)
      : await supabase.from("evolucoes").insert({ ...payload, paciente_id: pacienteId, especialidade_id: espId });
    if (!error && agId && !editar) {
      await supabase.from("agendamentos").update({ status: "realizado" }).eq("id", agId).in("status", ["agendado", "confirmado"]);
      qc.invalidateQueries({ queryKey: ["agenda"] });
    }
    setSalvando(false);
    if (error) { toast.error(erroAmigavel(error.message)); return; }
    toast.success(editar ? "Evolução atualizada." : "Evolução registrada.");
    qc.invalidateQueries({ queryKey: ["evolucoes", pacienteId] });
    onClose();
  }

  return (
    <div className="rounded-2xl border-2 border-primary/30 bg-card p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <FilePenLine className="size-5 text-primary" />
        <h3 className="font-semibold">{editar ? "Editar evolução" : "Nova evolução"}</h3>
        <Button variant="ghost" size="icon" className="ml-auto" onClick={onClose} aria-label="Fechar">
          <X />
        </Button>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="grid gap-1.5">
          <Label className="text-xs text-muted-foreground">Especialidade</Label>
          <Select value={espId} onValueChange={setEspId} disabled={!!editar}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {minhas.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label className="text-xs text-muted-foreground">Data do atendimento</Label>
          <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label className="text-xs text-muted-foreground">Vincular a atendimento</Label>
          <Select value={agId || "nenhum"} onValueChange={(v) => setAgId(v === "nenhum" ? "" : v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="nenhum">Sem vínculo</SelectItem>
              {meusAtend.slice(0, 40).map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {fmtData(a.inicio, "dd/MM")} {fmtHora(a.inicio)} · {a.especialidade?.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <Textarea
        className="mt-4 min-h-52 text-[15px] leading-relaxed"
        placeholder="Descreva a sessão: objetivos trabalhados, estratégias, resposta da criança, orientações à família..."
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
      />
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Assinatura: <span className="font-medium text-foreground">{me.nome}</span>
          {me.conselho || me.registro ? ` — ${[me.conselho, me.registro].filter(Boolean).join(" ")}` : " — registro não cadastrado"}
        </p>
        <Button onClick={salvar} disabled={salvando} className="w-full sm:w-auto">
          {salvando && <Loader2 className="animate-spin" />} Salvar evolução
        </Button>
      </div>
    </div>
  );
}
