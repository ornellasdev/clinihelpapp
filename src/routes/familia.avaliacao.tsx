import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { queryOptions, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2, Save, Send, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { enviarAnamnese } from "@/lib/anamnese.functions";
import {
  LIMITE_LONGO,
  PREFIXO_RASCUNHO,
  LIMITE_TEXTO,
  SECOES_ANAMNESE,
  TEXTO_LGPD_ANAMNESE,
  VERSAO_ANAMNESE,
  campoVisivel,
  errosDaSecao,
  preencherDaFicha,
  progresso,
  validarAnamnese,
  type Campo,
  type FichaAnamnese,
  type Respostas,
} from "@/lib/anamnese";
import { fmtData } from "@/lib/ui-helpers";
import { MolduraFamilia } from "./familia";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const avaliacaoQ = (p: string) =>
  queryOptions({
    queryKey: ["familia", p, "avaliacao"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("familia_avaliacao", { _paciente: p });
      if (error) throw new Error(error.message);
      return data?.[0] ?? null;
    },
  });

const chaveRascunho = (p: string) => `${PREFIXO_RASCUNHO}v${VERSAO_ANAMNESE}:${p}`;

export const Route = createFileRoute("/familia/avaliacao")({
  validateSearch: z.object({ crianca: z.string().uuid() }),
  loaderDeps: ({ search }) => ({ crianca: search.crianca }),
  loader: ({ context, deps }) => context.queryClient.ensureQueryData(avaliacaoQ(deps.crianca)),
  head: () => ({ meta: [{ title: "Formulário de avaliação — Área da família" }] }),
  component: FormularioAvaliacao,
});

function FormularioAvaliacao() {
  const { crianca } = Route.useSearch();
  const { data: av } = useSuspenseQuery(avaliacaoQ(crianca));
  const voltar = (
    <Button asChild variant="ghost" size="sm" className="text-sidebar-foreground hover:bg-sidebar-accent">
      <Link to="/familia" search={{ crianca }}>
        <ArrowLeft /> Voltar
      </Link>
    </Button>
  );

  if (!av || av.status === "aguardando_pagamento")
    return (
      <MolduraFamilia direita={voltar}>
        <div className="rounded-2xl border bg-card p-8 text-center">
          <h1 className="text-xl font-semibold">Formulário ainda não liberado</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            O formulário de avaliação é liberado aqui assim que o pagamento da avaliação inicial for confirmado.
          </p>
          <Button asChild className="mt-5">
            <Link to="/familia" search={{ crianca, aba: "pagamentos" }}>Ver pagamentos</Link>
          </Button>
        </div>
      </MolduraFamilia>
    );

  if (av.status === "concluida")
    return (
      <MolduraFamilia direita={voltar}>
        <Enviado nome={(av.ficha as FichaAnamnese).nome ?? ""} em={av.preenchido_em} por={av.preenchido_por_nome} crianca={crianca} />
      </MolduraFamilia>
    );

  return (
    <MolduraFamilia direita={voltar}>
      <Preencher pacienteId={crianca} ficha={av.ficha as FichaAnamnese} clinica={av.clinica_nome} />
    </MolduraFamilia>
  );
}

function Enviado({ nome, em, por, crianca }: { nome: string; em: string | null; por: string | null; crianca: string }) {
  return (
    <div className="rounded-2xl border border-success/40 bg-card p-8 text-center">
      <CheckCircle2 className="mx-auto size-10 text-success" />
      <h1 className="mt-3 text-xl font-semibold">Formulário enviado</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        A entrevista inicial de {nome.split(" ")[0] || "sua criança"} foi enviada{por ? ` por ${por}` : ""}
        {em ? ` em ${fmtData(em, "dd/MM/yyyy 'às' HH:mm")}` : ""}. A clínica já foi avisada e vai entrar em contato para agendar a primeira consulta.
      </p>
      <Button asChild className="mt-5">
        <Link to="/familia" search={{ crianca }}>Voltar para a Área da família</Link>
      </Button>
    </div>
  );
}

function Preencher({ pacienteId, ficha, clinica }: { pacienteId: string; ficha: FichaAnamnese; clinica: string }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const enviar = useServerFn(enviarAnamnese);
  const [r, setR] = useState<Respostas>(() => preencherDaFicha(ficha));
  const [passo, setPasso] = useState(0);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [lgpd, setLgpd] = useState(false);
  const carregou = useRef(false);
  const topo = useRef<HTMLDivElement>(null);

  // Rascunho no aparelho: quem fecha a página no meio não perde o que já respondeu.
  useEffect(() => {
    try {
      const salvo = localStorage.getItem(chaveRascunho(pacienteId));
      if (salvo) {
        const d = JSON.parse(salvo) as { r: Respostas; passo: number };
        setR(d.r);
        setPasso(Math.min(d.passo ?? 0, SECOES_ANAMNESE.length - 1));
      }
    } catch {
      /* rascunho inválido: começa do zero */
    }
    carregou.current = true;
  }, [pacienteId]);
  useEffect(() => {
    if (!carregou.current) return;
    const t = setTimeout(() => localStorage.setItem(chaveRascunho(pacienteId), JSON.stringify({ r, passo })), 400);
    return () => clearTimeout(t);
  }, [r, passo, pacienteId]);

  const secao = SECOES_ANAMNESE[passo]!;
  const ultimo = passo === SECOES_ANAMNESE.length - 1;
  const prog = useMemo(() => progresso(r), [r]);

  function mudar(id: string, v: string | string[]) {
    setR((a) => ({ ...a, [id]: v }));
    if (erros[id]) setErros(({ [id]: _, ...resto }) => resto);
  }

  function irPara(i: number) {
    setPasso(i);
    setErros({});
    topo.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function avancar() {
    const e = errosDaSecao(secao, r);
    if (Object.keys(e).length) {
      setErros(e);
      toast.error("Responda as perguntas destacadas para continuar.");
      document.getElementById(`campo-${Object.keys(e)[0]}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    if (!ultimo) return irPara(passo + 1);
    const v = validarAnamnese(r);
    if (!v.ok) {
      irPara(v.secao);
      setErros(v.erros);
      toast.error(v.mensagem);
      return;
    }
    setLgpd(true);
  }

  async function confirmarEnvio(nome: string, parentesco: string) {
    const v = validarAnamnese(r);
    if (!v.ok) return void toast.error(v.mensagem);
    await enviar({ data: { pacienteId, respostas: v.respostas, nome, parentesco, aceite: true } });
    localStorage.removeItem(chaveRascunho(pacienteId));
    toast.success("Formulário enviado! A clínica foi avisada.");
    await qc.invalidateQueries({ queryKey: ["familia", pacienteId] });
    setLgpd(false);
    navigate({ to: "/familia/avaliacao", search: { crianca: pacienteId }, replace: true });
  }

  return (
    <div ref={topo} className="scroll-mt-4 space-y-5">
      <div className="rounded-2xl border bg-card p-5">
        <p className="text-xs font-medium uppercase tracking-wide text-primary">{clinica}</p>
        <h1 className="text-xl font-semibold">Entrevista inicial com pais e responsáveis</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Anamnese e levantamento das necessidades terapêuticas de {(ficha.nome ?? "").split(" ")[0] || "sua criança"}. Responda todas as perguntas com o
          máximo de veracidade e detalhes. Se alguma não se aplicar, escreva “Não se aplica”. O que você digita fica guardado neste aparelho até o envio.
        </p>
        <div className="mt-4 flex items-center gap-3">
          <Progress value={(prog.feitas / Math.max(prog.total, 1)) * 100} className="h-2" />
          <span className="shrink-0 text-xs text-muted-foreground">
            {prog.feitas}/{prog.total}
          </span>
        </div>
        <div className="mt-3 flex gap-1 overflow-x-auto pb-1">
          {SECOES_ANAMNESE.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => irPara(i)}
              aria-label={s.titulo}
              className={cn("h-1.5 min-w-5 flex-1 rounded-full", i === passo ? "bg-primary" : i < passo ? "bg-primary/40" : "bg-muted")}
            />
          ))}
        </div>
      </div>

      <section className="rounded-2xl border bg-card p-5">
        <p className="text-xs text-muted-foreground">
          Parte {passo + 1} de {SECOES_ANAMNESE.length}
        </p>
        <h2 className="text-lg font-semibold">{secao.titulo}</h2>
        {secao.descricao && <p className="mt-1 text-sm text-muted-foreground">{secao.descricao}</p>}
        <div className="mt-5 space-y-5">
          {secao.campos
            .filter((c) => campoVisivel(c, r))
            .map((c) => (
              <div key={c.id}>
                {c.grupo && <h3 className="mb-3 border-b pb-1 text-sm font-semibold text-primary">{c.grupo}</h3>}
                <CampoForm campo={c} valor={r[c.id]} erro={erros[c.id]} onChange={(v) => mudar(c.id, v)} />
              </div>
            ))}
        </div>
      </section>

      <div className="flex items-center gap-2">
        <Button variant="outline" className="h-11" onClick={() => irPara(passo - 1)} disabled={passo === 0}>
          <ArrowLeft /> Anterior
        </Button>
        <span className="flex-1 text-center text-xs text-muted-foreground">
          <Save className="mr-1 inline size-3" /> Rascunho salvo
        </span>
        <Button className="h-11" onClick={avancar}>
          {ultimo ? (
            <>
              <Send /> Revisar e enviar
            </>
          ) : (
            <>
              Próxima <ArrowRight />
            </>
          )}
        </Button>
      </div>

      {lgpd && (
        <ConfirmacaoLgpd
          sugestaoNome={typeof r["resp1_nome"] === "string" ? r["resp1_nome"] : ""}
          sugestaoParentesco={typeof r["resp1_parentesco"] === "string" ? r["resp1_parentesco"] : ""}
          onClose={() => setLgpd(false)}
          onConfirmar={confirmarEnvio}
        />
      )}
    </div>
  );
}

function CampoForm({ campo: c, valor, erro, onChange }: { campo: Campo; valor: string | string[] | undefined; erro?: string; onChange: (v: string | string[]) => void }) {
  const id = `campo-${c.id}`;
  const texto = typeof valor === "string" ? valor : "";
  const lista = Array.isArray(valor) ? valor : [];
  const rotulo = (
    <Label htmlFor={id} className="mb-2 block leading-snug">
      {c.rotulo}
      {c.opcional && <span className="ml-1 font-normal text-muted-foreground">(opcional)</span>}
    </Label>
  );
  return (
    <div id={id} className="scroll-mt-24">
      {rotulo}
      {c.tipo === "texto" && (
        <Input
          id={id}
          value={texto}
          maxLength={LIMITE_TEXTO}
          inputMode={c.formato === "telefone" || c.formato === "cpf" ? "numeric" : c.formato === "email" ? "email" : undefined}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={!!erro}
        />
      )}
      {c.tipo === "longo" && <Textarea id={id} rows={3} value={texto} maxLength={LIMITE_LONGO} onChange={(e) => onChange(e.target.value)} aria-invalid={!!erro} />}
      {c.tipo === "data" && <Input id={id} type="date" value={texto} max={new Date().toISOString().slice(0, 10)} onChange={(e) => onChange(e.target.value)} aria-invalid={!!erro} />}
      {(c.tipo === "simnao" || c.tipo === "escolha") && (
        <div role="radiogroup" className="flex flex-wrap gap-2">
          {c.opcoes!.map((o) => (
            <button
              key={o}
              type="button"
              role="radio"
              aria-checked={texto === o}
              onClick={() => onChange(o)}
              className={cn(
                "min-h-10 rounded-full border px-4 text-sm transition",
                texto === o ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:border-primary/50",
                erro && texto !== o && "border-destructive/60",
              )}
            >
              {o}
            </button>
          ))}
        </div>
      )}
      {c.tipo === "multipla" && (
        <div className="flex flex-wrap gap-2">
          {c.opcoes!.map((o) => {
            const marcado = lista.includes(o);
            return (
              <label
                key={o}
                className={cn(
                  "flex min-h-10 cursor-pointer items-center gap-2 rounded-full border px-4 text-sm",
                  marcado ? "border-primary bg-primary/10" : "bg-background",
                  erro && "border-destructive/60",
                )}
              >
                <Checkbox checked={marcado} onCheckedChange={(v) => onChange(v ? [...lista, o] : lista.filter((x) => x !== o))} />
                {o}
              </label>
            );
          })}
        </div>
      )}
      {erro && <p className="mt-1 text-xs text-destructive">{erro}</p>}
    </div>
  );
}

function ConfirmacaoLgpd({
  sugestaoNome,
  sugestaoParentesco,
  onClose,
  onConfirmar,
}: {
  sugestaoNome: string;
  sugestaoParentesco: string;
  onClose: () => void;
  onConfirmar: (nome: string, parentesco: string) => Promise<void>;
}) {
  const [nome, setNome] = useState(sugestaoNome);
  const [parentesco, setParentesco] = useState(sugestaoParentesco);
  const [aceite, setAceite] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const pronto = aceite && nome.trim().length >= 3 && parentesco.trim().length >= 2;

  async function confirmar() {
    setEnviando(true);
    try {
      await onConfirmar(nome.trim(), parentesco.trim());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível enviar.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && !enviando && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="size-5 text-primary" /> Proteção dos dados (LGPD)
          </DialogTitle>
          <DialogDescription>Leia com atenção antes de enviar o formulário.</DialogDescription>
        </DialogHeader>
        <div className="max-h-64 space-y-3 overflow-y-auto rounded-xl border bg-muted/40 p-4 text-sm leading-relaxed">
          {TEXTO_LGPD_ANAMNESE.split("\n\n").map((p) => (
            <p key={p.slice(0, 20)}>{p}</p>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="lgpd-nome">Seu nome completo</Label>
            <Input id="lgpd-nome" value={nome} maxLength={150} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lgpd-par">Parentesco com a criança</Label>
            <Input id="lgpd-par" value={parentesco} maxLength={40} onChange={(e) => setParentesco(e.target.value)} placeholder="Mãe, pai, avó..." />
          </div>
        </div>
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm">
          <Checkbox checked={aceite} onCheckedChange={(v) => setAceite(v === true)} className="mt-0.5" />
          <span>Li e concordo. Confirmo que as informações são verdadeiras e estou ciente de como a clínica tratará os dados.</span>
        </label>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={enviando}>
            Voltar ao formulário
          </Button>
          <Button onClick={confirmar} disabled={!pronto || enviando}>
            {enviando ? <Loader2 className="animate-spin" /> : <Send />} Confirmar e enviar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
