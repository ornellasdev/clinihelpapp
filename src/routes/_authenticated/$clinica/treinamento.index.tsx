import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { CheckCircle2, Clock, GraduationCap, RotateCcw, Users } from "lucide-react";
import { meQuery, equipeQuery } from "@/lib/queries";
import { useMe } from "@/hooks/use-me";
import { useClinica } from "@/hooks/use-clinica";
import { PAPEIS, ehGestor } from "@/lib/permissions";
import { CATEGORIAS, MODULOS, type Modulo } from "@/lib/treinamento/conteudo";
import { NOTA_MINIMA, modulosDaTrilha, progressoDaTrilha, situacaoDoTopico, type ResultadoTreinamento } from "@/lib/treinamento/trilha";
import { meusResultadosQuery, resultadosEquipeQuery } from "@/services/treinamento";
import { fmtData } from "@/lib/ui-helpers";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/$clinica/treinamento/")({
  loader: async ({ context }) => {
    const me = await context.queryClient.ensureQueryData(meQuery);
    await context.queryClient.ensureQueryData(meusResultadosQuery(me.id));
  },
  head: () => ({ meta: [{ title: "Treinamento — CliniHelp" }] }),
  component: TreinamentoPage,
});

function TreinamentoPage() {
  const me = useMe();
  const { data: resultados } = useSuspenseQuery(meusResultadosQuery(me.id));
  const trilha = modulosDaTrilha(me.papeis, me.dev);
  const outros = MODULOS.filter((m) => !trilha.includes(m));
  const prog = progressoDaTrilha(me.papeis, resultados, me.dev);
  const cargos = me.dev ? "Desenvolvedor (todos os tópicos)" : me.papeis.map((p) => PAPEIS.find((x) => x.value === p)?.label).join(" · ");

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Treinamento CliniHelp"
        descricao={`Sua trilha de acordo com o seu cargo: ${cargos}. Leia cada tópico e responda o questionário — é preciso acertar ${Math.round(NOTA_MINIMA * 100)}% para concluir.`}
      />

      <section className="rounded-2xl border border-primary/25 bg-secondary/40 p-5">
        <div className="flex flex-wrap items-center gap-4">
          <GraduationCap className="size-10 text-primary" />
          <div className="min-w-0 flex-1">
            <div className="font-display text-lg font-semibold">
              {prog.concluidos} de {prog.obrigatorios} tópicos concluídos
            </div>
            <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-card">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${prog.percentual}%` }} />
            </div>
          </div>
          <div className="font-display text-3xl font-semibold text-primary">{prog.percentual}%</div>
        </div>
      </section>

      {CATEGORIAS.map((cat) => {
        const lista = trilha.filter((m) => m.categoria === cat);
        if (!lista.length) return null;
        return (
          <section key={cat}>
            <h2 className="mb-3 text-base font-semibold">{cat}</h2>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {lista.map((m) => (
                <CartaoTopico key={m.id} modulo={m} resultados={resultados} />
              ))}
            </div>
          </section>
        );
      })}

      {outros.length > 0 && (
        <details className="rounded-2xl border bg-card p-4">
          <summary className="cursor-pointer text-sm font-medium">Outros tópicos (fora da sua trilha) · {outros.length}</summary>
          <p className="mt-2 text-xs text-muted-foreground">Opcionais: ajudam a entender o trabalho dos outros setores.</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {outros.map((m) => (
              <CartaoTopico key={m.id} modulo={m} resultados={resultados} />
            ))}
          </div>
        </details>
      )}

      {ehGestor(me.papeis) && <ProgressoEquipe />}
    </div>
  );
}

const SITUACAO = {
  concluido: { rotulo: "Concluído", classe: "bg-success/15 text-success", icone: CheckCircle2 },
  refazer: { rotulo: "Refazer", classe: "bg-warning/20 text-warning-foreground", icone: RotateCcw },
  pendente: { rotulo: "Não iniciado", classe: "bg-muted text-muted-foreground", icone: Clock },
} as const;

function CartaoTopico({ modulo, resultados }: { modulo: Modulo; resultados: ResultadoTreinamento[] }) {
  const clinica = useClinica();
  const s = situacaoDoTopico(modulo, resultados);
  const st = SITUACAO[s.situacao];
  return (
    <Link
      to="/$clinica/treinamento/$modulo"
      params={{ clinica, modulo: modulo.id }}
      className="flex flex-col rounded-2xl border bg-card p-4 transition hover:border-primary/40 hover:shadow-sm"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-semibold leading-snug">{modulo.titulo}</span>
        <span className={cn("inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium", st.classe)}>
          <st.icone className="size-3" /> {st.rotulo}
        </span>
      </div>
      <p className="mt-1 flex-1 text-sm text-muted-foreground">{modulo.resumo}</p>
      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {modulo.minutos} min · {modulo.questoes.length} perguntas
        </span>
        {s.melhor && (
          <span>
            Melhor nota: {s.melhor.acertos}/{s.melhor.total}
          </span>
        )}
      </div>
    </Link>
  );
}

function ProgressoEquipe() {
  const { data: equipe = [] } = useQuery(equipeQuery);
  const { data: resultados = [] } = useQuery(resultadosEquipeQuery);
  const linhas = useMemo(
    () =>
      equipe
        .filter((m) => m.ativo && m.papeis.length)
        .map((m) => {
          const meus = resultados.filter((r) => r.user_id === m.id);
          return { m, prog: progressoDaTrilha(m.papeis, meus), ultimo: meus[0]?.created_at ?? null };
        })
        .sort((a, b) => a.prog.percentual - b.prog.percentual || a.m.nome.localeCompare(b.m.nome)),
    [equipe, resultados],
  );

  return (
    <section className="rounded-2xl border bg-card p-5">
      <header className="mb-3 flex flex-wrap items-center gap-2">
        <Users className="size-5 text-primary" />
        <h2 className="text-base font-semibold">Progresso da equipe</h2>
        <span className="text-sm text-muted-foreground">
          {linhas.filter((l) => l.prog.percentual === 100).length} de {linhas.length} pessoas com a trilha completa
        </span>
      </header>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="text-left text-xs text-muted-foreground">
            <tr>
              <th className="py-2 pr-3 font-medium">Pessoa</th>
              <th className="py-2 pr-3 font-medium">Cargo</th>
              <th className="py-2 pr-3 font-medium">Trilha</th>
              <th className="py-2 font-medium">Última atividade</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {linhas.map(({ m, prog, ultimo }) => (
              <tr key={m.id}>
                <td className="py-2 pr-3 font-medium">{m.nome}</td>
                <td className="py-2 pr-3 text-muted-foreground">{m.papeis.map((p) => PAPEIS.find((x) => x.value === p)?.label).join(" · ")}</td>
                <td className="py-2 pr-3">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-28 overflow-hidden rounded-full bg-muted">
                      <div className={cn("h-full rounded-full", prog.percentual === 100 ? "bg-success" : "bg-primary")} style={{ width: `${prog.percentual}%` }} />
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {prog.concluidos}/{prog.obrigatorios}
                    </span>
                  </div>
                </td>
                <td className="py-2 text-muted-foreground">{ultimo ? fmtData(ultimo, "dd/MM/yyyy") : "Ainda não começou"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Button asChild variant="link" size="sm" className="mt-2 px-0">
        <Link to="/$clinica/seguranca" params={{ clinica: useClinica() }}>
          Ver no painel de conformidade
        </Link>
      </Button>
    </section>
  );
}
