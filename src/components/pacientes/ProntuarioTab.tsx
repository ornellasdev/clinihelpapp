import { useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarSearch, FilePenLine, FilePlus2, Loader2, Lock, Plus, ShieldCheck, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { agendaPacienteQuery, especialidadesQuery, evolucoesQuery, metasQuery } from "@/lib/queries";
import { adendosQuery, agruparAdendos } from "@/services/prontuario";
import { ErroServico, mensagemDeErro } from "@/services/resultado";
import { useRegistrarEvolucao } from "@/hooks/use-prontuario";
import { aplicarModelo } from "@/lib/plano-terapeutico";
import { ehFalta, iniciaAoAbrirEvolucao } from "@/lib/agenda-status";
import { ModelosEvolucao } from "./ModelosEvolucao";
import { MetasNaEvolucao } from "./MetasNaEvolucao";
import { VozEvolucao } from "./VozEvolucao";
import { RelatorioPdfDialog } from "./RelatorioPdfDialog";
import { AdendoDialog } from "./AdendoDialog";
import { useMe } from "@/hooks/use-me";
import { podeRegistrarAdendo, podeVerProntuario } from "@/lib/permissions";
import { corEsp, fmtData, fmtHora } from "@/lib/ui-helpers";
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
  const { data: adendos = [] } = useQuery(adendosQuery(pacienteId));
  const [esp, setEsp] = useState("todas");
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const [form, setForm] = useState<{ agendamentoId?: string | undefined } | null>(agendamentoId ? { agendamentoId } : null);
  const [adendoDe, setAdendoDe] = useState<Evolucao | null>(null);

  const visiveis = especialidades.filter((e) => podeVerProntuario(me.papeis, me.especialidades, e.id));
  const espMap = useMemo(() => Object.fromEntries(especialidades.map((e) => [e.id, e])), [especialidades]);
  const adendosPorEvolucao = useMemo(() => agruparAdendos(adendos), [adendos]);

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
          <RelatorioPdfDialog pacienteId={pacienteId} especialidades={visiveis} />
          {me.especialidades.length > 0 && !form && (
            <Button onClick={() => setForm({})} className="w-full sm:w-auto">
              <Plus /> Nova evolução
            </Button>
          )}
        </div>

        {form && <EvolucaoForm pacienteId={pacienteId} agendamentoId={form.agendamentoId} onClose={() => setForm(null)} />}

        <div className="text-sm text-muted-foreground">
          {filtradas.length} evolução(ões){filtroData && " no período"}
        </div>

        {filtradas.map((e) => {
          const espe = espMap[e.especialidade_id];
          const lista = adendosPorEvolucao.get(e.id) ?? [];
          return (
            <article key={e.id} className="rounded-2xl border bg-card p-5">
              <header className="mb-3 flex flex-wrap items-center gap-2">
                <span className="font-display text-lg font-semibold">{fmtData(e.data_atendimento, "dd/MM/yyyy")}</span>
                <span className={cn("rounded-full border px-2.5 py-0.5 text-xs font-medium", corEsp(espe?.cor))}>{espe?.nome}</span>
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground" title="Evolução assinada: não pode ser alterada nem apagada">
                  <Lock className="size-3" /> Assinada
                </span>
                {podeRegistrarAdendo(me.especialidades, e.especialidade_id) && (
                  <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setAdendoDe(e)}>
                    <FilePlus2 /> Adendo
                  </Button>
                )}
              </header>
              <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{e.conteudo}</p>
              <footer className="mt-4 border-t pt-3 text-sm">
                <div className="font-medium">{e.profissional_nome}</div>
                <div className="text-xs text-muted-foreground">
                  {e.profissional_registro ?? "Registro profissional não informado"} · registrado em{" "}
                  {fmtData(e.created_at, "dd/MM/yyyy 'às' HH:mm")}
                </div>
              </footer>
              {lista.length > 0 && (
                <div className="mt-4 space-y-3">
                  {lista.map((a) => (
                    <div key={a.id} className="rounded-xl border-l-4 border-primary/50 bg-surface p-3">
                      <div className="mb-1 flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary">
                        <ShieldCheck className="size-3.5" /> Adendo{a.motivo ? ` · ${a.motivo}` : ""}
                      </div>
                      <p className="whitespace-pre-wrap text-sm leading-relaxed">{a.conteudo}</p>
                      <div className="mt-2 text-xs text-muted-foreground">
                        {a.profissional_nome}
                        {a.profissional_registro ? ` — ${a.profissional_registro}` : ""} · {fmtData(a.created_at, "dd/MM/yyyy 'às' HH:mm")}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </article>
          );
        })}
      </div>

      <AdendoDialog evolucao={adendoDe} onClose={() => setAdendoDe(null)} />
    </div>
  );
}

function EvolucaoForm({
  pacienteId,
  agendamentoId,
  onClose,
}: {
  pacienteId: string;
  agendamentoId?: string | undefined;
  onClose: () => void;
}) {
  const me = useMe();
  const qc = useQueryClient();
  const registrar = useRegistrarEvolucao(pacienteId);
  const { data: especialidades } = useSuspenseQuery(especialidadesQuery);
  const { data: metas } = useSuspenseQuery(metasQuery(pacienteId));
  const { data: agenda = [] } = useQuery(agendaPacienteQuery(pacienteId));
  const minhas = especialidades.filter((e) => me.especialidades.includes(e.id));
  const meusAtend = agenda.filter((a) => a.profissional_id === me.id && a.status !== "cancelado" && !ehFalta(a.status));

  const [espId, setEspId] = useState(minhas.length === 1 ? minhas[0]!.id : "");
  const [data, setData] = useState(format(new Date(), "yyyy-MM-dd"));
  const [agId, setAgId] = useState(agendamentoId ?? "");
  const [texto, setTexto] = useState("");
  const [modeloUsado, setModeloUsado] = useState("");
  const [niveis, setNiveis] = useState<Record<string, number>>({});
  const [erroCampo, setErroCampo] = useState<string | null>(null);

  const metasDaEsp = metas.filter((m) => m.especialidade_id === espId && m.status === "ativa");
  const espNome = especialidades.find((e) => e.id === espId)?.nome ?? "";

  useEffect(() => {
    if (!agId) return;
    const a = agenda.find((x) => x.id === agId);
    if (a) {
      setData(format(parseISO(a.inicio), "yyyy-MM-dd"));
      if (me.especialidades.includes(a.especialidade_id)) setEspId(a.especialidade_id);
    }
  }, [agId, agenda, me.especialidades]);

  // Abrir a evolução da sessão de hoje inicia o atendimento ("Em atendimento").
  const iniciado = useRef<string | null>(null);
  useEffect(() => {
    if (!agId || iniciado.current === agId) return;
    const a = agenda.find((x) => x.id === agId);
    if (!a || a.profissional_id !== me.id || !iniciaAoAbrirEvolucao(a.status)) return;
    if (format(parseISO(a.inicio), "yyyy-MM-dd") !== format(new Date(), "yyyy-MM-dd")) return;
    iniciado.current = agId;
    void supabase
      .from("agendamentos")
      .update({ status: "em_atendimento" })
      .eq("id", agId)
      .then(({ error }) => {
        if (!error) qc.invalidateQueries({ queryKey: ["agenda"] });
      });
  }, [agId, agenda, me.id, qc]);

  async function salvar() {
    setErroCampo(null);
    const sessao = agenda.find((x) => x.id === agId);
    try {
      await registrar.mutateAsync({
        pacienteId,
        especialidadeId: espId,
        data,
        conteudo: texto,
        agendamentoId: agId || null,
        metas: metasDaEsp.filter((m) => niveis[m.id] !== undefined).map((m) => ({ meta_id: m.id, nivel: niveis[m.id]! })),
      });
      const finalizou = !!sessao && (sessao.status === "agendado" || sessao.status === "aguardando" || sessao.status === "em_atendimento");
      toast.success(finalizou ? "Evolução registrada e atendimento finalizado." : "Evolução registrada.");
      onClose();
    } catch (e) {
      if (e instanceof ErroServico && e.campo) setErroCampo(e.campo);
      toast.error(mensagemDeErro(e));
    }
  }

  return (
    <div className="rounded-2xl border-2 border-primary/30 bg-card p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex items-center gap-2">
        <FilePenLine className="size-5 text-primary" />
        <h3 className="font-semibold">Nova evolução</h3>
        <Button variant="ghost" size="icon" className="ml-auto" onClick={onClose} aria-label="Fechar">
          <X />
        </Button>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="grid gap-1.5">
          <Label className={cn("text-xs text-muted-foreground", erroCampo === "especialidadeId" && "text-destructive")}>Especialidade</Label>
          <Select value={espId} onValueChange={setEspId}>
            <SelectTrigger aria-invalid={erroCampo === "especialidadeId"}>
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
          <Label className={cn("text-xs text-muted-foreground", erroCampo === "data" && "text-destructive")}>Data do atendimento</Label>
          <Input type="date" value={data} max={format(new Date(), "yyyy-MM-dd")} onChange={(e) => setData(e.target.value)} aria-invalid={erroCampo === "data"} />
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

      <ModelosEvolucao
        especialidadeId={espId}
        especialidadeNome={espNome}
        onUsar={(c) => {
          setModeloUsado(c);
          setTexto((t) => aplicarModelo(t, c));
        }}
      />

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <VozEvolucao
          especialidadeId={espId}
          modelo={modeloUsado}
          onTexto={(t) => setTexto((atual) => (atual.trim() && atual.trim() !== modeloUsado.trim() ? `${atual.trimEnd()}\n\n${t}` : t))}
        />
        <p className="text-xs text-muted-foreground">Fale sobre a sessão; a IA escreve o texto e você revisa antes de salvar.</p>
      </div>

      <Textarea
        className={cn("mt-3 min-h-52 text-[15px] leading-relaxed", erroCampo === "conteudo" && "border-destructive")}
        placeholder="Descreva a sessão: objetivos trabalhados, estratégias, resposta da criança, orientações à família..."
        value={texto}
        maxLength={20000}
        onChange={(e) => setTexto(e.target.value)}
      />

      <MetasNaEvolucao
        metas={metasDaEsp}
        niveis={niveis}
        onChange={(id, n) =>
          setNiveis((cur) => {
            const novo = { ...cur };
            if (n === null) delete novo[id];
            else novo[id] = n;
            return novo;
          })
        }
      />

      <p className="mt-4 flex items-start gap-2 rounded-lg bg-muted p-3 text-xs text-muted-foreground">
        <Lock className="mt-0.5 size-3.5 shrink-0" />
        Ao salvar, a evolução e o progresso das metas ficam assinados e não podem mais ser editados nem apagados. Correções
        posteriores são feitas por adendo.
      </p>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Assinatura: <span className="font-medium text-foreground">{me.nome}</span>
          {me.conselho || me.registro ? ` — ${[me.conselho, me.registro].filter(Boolean).join(" ")}` : " — registro não cadastrado"}
        </p>
        <Button onClick={salvar} disabled={registrar.isPending} className="w-full sm:w-auto">
          {registrar.isPending && <Loader2 className="animate-spin" />} Assinar e salvar evolução
        </Button>
      </div>
    </div>
  );
}
