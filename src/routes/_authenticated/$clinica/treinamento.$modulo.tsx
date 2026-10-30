import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AlertTriangle, ArrowLeft, CheckCircle2, ClipboardCheck, Loader2, RotateCcw, XCircle } from "lucide-react";
import { toast } from "sonner";
import { meQuery } from "@/lib/queries";
import { useMe } from "@/hooks/use-me";
import { useClinica } from "@/hooks/use-clinica";
import { moduloPorId } from "@/lib/treinamento/conteudo";
import { NOTA_MINIMA, modulosDaTrilha, situacaoDoTopico, type Correcao } from "@/lib/treinamento/trilha";
import { meusResultadosQuery } from "@/services/treinamento";
import { mensagemDeErro } from "@/services/resultado";
import { useEnviarQuestionario } from "@/hooks/use-treinamento";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/$clinica/treinamento/$modulo")({
  loader: async ({ context, params }) => {
    const modulo = moduloPorId(params.modulo);
    if (!modulo) throw notFound();
    const me = await context.queryClient.ensureQueryData(meQuery);
    await context.queryClient.ensureQueryData(meusResultadosQuery(me.id));
    return { titulo: modulo.titulo };
  },
  head: ({ loaderData }) => ({ meta: [{ title: `${loaderData?.titulo ?? "Treinamento"} — Treinamento CliniHelp` }] }),
  notFoundComponent: () => <p className="py-10 text-center text-sm text-muted-foreground">Tópico de treinamento não encontrado.</p>,
  component: TopicoPage,
});

const LETRAS = ["A", "B", "C", "D", "E", "F"];

function TopicoPage() {
  const clinica = useClinica();
  const me = useMe();
  const { modulo: id } = Route.useParams();
  const modulo = moduloPorId(id)!;
  const { data: resultados } = useSuspenseQuery(meusResultadosQuery(me.id));
  const situacao = situacaoDoTopico(modulo, resultados);
  const naTrilha = modulosDaTrilha(me.papeis, me.dev).includes(modulo);
  const enviar = useEnviarQuestionario();
  const [respostas, setRespostas] = useState<number[]>(() => modulo.questoes.map(() => -1));
  const [correcao, setCorrecao] = useState<Correcao | null>(null);
  const faltam = respostas.filter((r) => r < 0).length;

  async function corrigir() {
    if (faltam) return void toast.error(`Responda todas as perguntas (faltam ${faltam}).`);
    try {
      const r = await enviar.mutateAsync({ moduloId: modulo.id, respostas });
      setCorrecao(r);
      if (r.aprovado) toast.success(`Tópico concluído! Você acertou ${r.acertos} de ${r.total}.`);
      else toast.error(`Você acertou ${r.acertos} de ${r.total}. Revise o conteúdo e tente de novo.`);
    } catch (e) {
      toast.error(mensagemDeErro(e));
    }
  }

  function refazer() {
    setRespostas(modulo.questoes.map(() => -1));
    setCorrecao(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2">
        <Link to="/$clinica/treinamento" params={{ clinica }}>
          <ArrowLeft /> Treinamento
        </Link>
      </Button>

      <header className="mb-6">
        <div className="text-xs font-semibold uppercase tracking-wide text-primary">
          {modulo.categoria} · {modulo.minutos} min
        </div>
        <h1 className="mt-1 text-2xl font-semibold md:text-3xl">{modulo.titulo}</h1>
        <p className="mt-1 text-muted-foreground">{modulo.resumo}</p>
        {situacao.situacao === "concluido" && (
          <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-success/15 px-3 py-1 text-sm font-medium text-success">
            <CheckCircle2 className="size-4" /> Concluído
            {situacao.melhor && ` · ${situacao.melhor.acertos}/${situacao.melhor.total}`}
          </p>
        )}
        {!naTrilha && <p className="mt-3 text-sm text-muted-foreground">Este tópico não é obrigatório para o seu cargo, mas você pode estudar e responder.</p>}
      </header>

      {/* Aula */}
      <div className="space-y-4">
        {modulo.secoes.map((s, i) => (
          <section key={i} className="rounded-2xl border bg-card p-5">
            <h2 className="mb-2 text-lg font-semibold">
              <span className="mr-2 text-primary">{i + 1}.</span>
              {s.titulo}
            </h2>
            {s.texto?.map((t, j) => (
              <p key={j} className="mb-2 leading-relaxed">
                {t}
              </p>
            ))}
            {s.itens && (
              <ul className="ml-5 list-disc space-y-1.5 leading-relaxed marker:text-primary">
                {s.itens.map((t, j) => (
                  <li key={j}>{t}</li>
                ))}
              </ul>
            )}
            {s.atencao && (
              <p className="mt-3 flex items-start gap-2 rounded-xl bg-warning/15 p-3 text-sm">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
                {s.atencao}
              </p>
            )}
          </section>
        ))}
      </div>

      {/* Questionário */}
      <section className="mt-8 rounded-2xl border-2 border-primary/30 bg-card p-5">
        <header className="mb-4 flex flex-wrap items-center gap-2">
          <ClipboardCheck className="size-5 text-primary" />
          <h2 className="text-lg font-semibold">Questionário</h2>
          <span className="text-sm text-muted-foreground">
            {modulo.questoes.length} perguntas · acerte {Math.ceil(modulo.questoes.length * NOTA_MINIMA)} para concluir
          </span>
        </header>

        <ol className="space-y-6">
          {modulo.questoes.map((q, i) => {
            const g = correcao?.gabarito[i];
            return (
              <li key={i}>
                <fieldset disabled={!!correcao}>
                  <legend className="mb-2 font-medium">
                    {i + 1}. {q.pergunta}
                  </legend>
                  <div className="grid gap-2">
                    {q.opcoes.map((op, j) => {
                      const marcada = respostas[i] === j;
                      const certa = g && j === g.correta;
                      const errada = g && marcada && !g.acertou;
                      return (
                        <label
                          key={j}
                          className={cn(
                            "flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm transition-colors",
                            !g && marcada && "border-primary bg-secondary/50",
                            !g && !marcada && "hover:bg-surface",
                            certa && "border-success bg-success/10",
                            errada && "border-destructive bg-destructive/10",
                            g && "cursor-default",
                          )}
                        >
                          <input
                            type="radio"
                            name={`q${i}`}
                            className="sr-only"
                            checked={marcada}
                            onChange={() => setRespostas((r) => r.map((x, k) => (k === i ? j : x)))}
                          />
                          <span
                            className={cn(
                              "flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
                              marcada && !g && "border-primary bg-primary text-primary-foreground",
                            )}
                          >
                            {LETRAS[j]}
                          </span>
                          <span className="flex-1 pt-0.5">{op}</span>
                          {certa && <CheckCircle2 className="size-4 shrink-0 text-success" />}
                          {errada && <XCircle className="size-4 shrink-0 text-destructive" />}
                        </label>
                      );
                    })}
                  </div>
                  {g && (
                    <p className={cn("mt-2 rounded-lg p-2.5 text-sm", g.acertou ? "bg-success/10" : "bg-muted")}>
                      <span className="font-medium">{g.acertou ? "Certo! " : "Resposta correta: " + LETRAS[g.correta] + ". "}</span>
                      {q.explicacao}
                    </p>
                  )}
                </fieldset>
              </li>
            );
          })}
        </ol>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
          {correcao ? (
            <>
              <p className={cn("font-semibold", correcao.aprovado ? "text-success" : "text-destructive")}>
                {correcao.aprovado ? "Aprovado" : "Ainda não foi desta vez"} · {correcao.acertos} de {correcao.total} acertos
              </p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={refazer}>
                  <RotateCcw /> Refazer
                </Button>
                <Button asChild>
                  <Link to="/$clinica/treinamento" params={{ clinica }}>
                    Voltar à trilha
                  </Link>
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">{faltam ? `Faltam ${faltam} respostas.` : "Tudo respondido."}</p>
              <Button onClick={corrigir} disabled={enviar.isPending}>
                {enviar.isPending && <Loader2 className="animate-spin" />} Enviar respostas
              </Button>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
