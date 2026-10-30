import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { AlertTriangle, CheckCircle2, Database, KeyRound, Loader2, RefreshCw, ScrollText, ShieldAlert, UserX, XCircle } from "lucide-react";
import { painelGovernancaQuery } from "@/services/governanca";
import { NORMAS, avaliarControles, resumoConformidade, type Situacao } from "@/lib/conformidade";
import { PAPEIS } from "@/lib/permissions";
import { fmtData } from "@/lib/ui-helpers";
import { useClinica } from "@/hooks/use-clinica";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/$clinica/seguranca/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(painelGovernancaQuery),
  head: () => ({ meta: [{ title: "Conformidade LGPD, ISO e HIPAA — CliniHelp" }] }),
  component: ConformidadePage,
  errorComponent: ({ error }) => (
    <div role="alert" className="rounded-2xl border bg-card p-6 text-sm">
      <p className="font-medium">Não foi possível carregar o painel de conformidade.</p>
      <p className="mt-1 text-muted-foreground">{error instanceof Error ? error.message : String(error)}</p>
    </div>
  ),
});

const ESTILO: Record<Situacao, { icon: typeof CheckCircle2; cor: string; rotulo: string }> = {
  ok: { icon: CheckCircle2, cor: "text-success", rotulo: "Em ordem" },
  atencao: { icon: AlertTriangle, cor: "text-warning", rotulo: "Atenção" },
  critico: { icon: XCircle, cor: "text-destructive", rotulo: "Crítico" },
};

const nomePapel = (p: string) => PAPEIS.find((x) => x.value === p)?.label ?? p;

function ConformidadePage() {
  const clinica = useClinica();
  const { data: p, refetch, isFetching } = useSuspenseQuery(painelGovernancaQuery);
  const controles = useMemo(() => avaliarControles(p), [p]);
  const r = resumoConformidade(controles);
  const excluidos = p.integridade.excluidos;
  const totalExcluidos = excluidos.guias + excluidos.glosas + excluidos.documentos + excluidos.relatorios;

  return (
    <div className="space-y-6">
      {/* Resumo */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Cartao titulo="Controles em ordem" valor={`${r.percentual}%`} detalhe={`${r.ok} de ${r.total} controles`} destaque />
        <Cartao titulo="Críticos" valor={String(r.critico)} detalhe={r.critico ? "Resolver antes de tudo" : "Nenhum"} tom={r.critico ? "critico" : "ok"} />
        <Cartao titulo="Pedem atenção" valor={String(r.atencao)} detalhe={r.atencao ? "Veja os itens abaixo" : "Nenhum"} tom={r.atencao ? "atencao" : "ok"} />
        <Cartao titulo="Eventos registrados" valor={String(p.auditoria.eventos_30d)} detalhe="Nos últimos 30 dias" />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>Verificado em {fmtData(p.gerado_em, "dd/MM/yyyy 'às' HH:mm")}, direto no banco de dados.</span>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          {isFetching ? <Loader2 className="animate-spin" /> : <RefreshCw />} Verificar de novo
        </Button>
      </div>

      {/* Controles por norma */}
      <div className="grid gap-4 lg:grid-cols-2">
        {NORMAS.map(({ norma, descricao }) => (
          <section key={norma} className="rounded-2xl border bg-card p-5">
            <header className="mb-3">
              <h2 className="text-base font-semibold">{norma}</h2>
              <p className="text-xs text-muted-foreground">{descricao}</p>
            </header>
            <ul className="divide-y">
              {controles
                .filter((c) => c.norma === norma)
                .map((c) => {
                  const e = ESTILO[c.situacao];
                  return (
                    <li key={c.id} className="flex gap-3 py-3">
                      <e.icon className={cn("mt-0.5 size-5 shrink-0", e.cor)} aria-label={e.rotulo} />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-baseline gap-x-2">
                          <span className="font-medium">{c.titulo}</span>
                          <span className="text-xs text-muted-foreground">{c.referencia}</span>
                        </div>
                        <p className="text-sm text-muted-foreground">{c.detalhe}</p>
                      </div>
                    </li>
                  );
                })}
            </ul>
          </section>
        ))}
      </div>

      {/* Pacientes sem termo LGPD */}
      <section className="rounded-2xl border bg-card p-5">
        <header className="mb-3 flex flex-wrap items-center gap-2">
          <ShieldAlert className="size-5 text-warning" />
          <h2 className="text-base font-semibold">Pacientes sem termo LGPD assinado</h2>
          <span className="text-sm text-muted-foreground">
            {p.lgpd.assinado} de {p.lgpd.ativos} pacientes ativos com consentimento
          </span>
        </header>
        {p.lgpd.pendentes_lista.length === 0 ? (
          <p className="text-sm text-muted-foreground">Todos os pacientes ativos têm o termo de consentimento assinado.</p>
        ) : (
          <>
            <p className="mb-3 text-sm text-muted-foreground">
              Peça a assinatura na aba Família de cada paciente. O consentimento é registrado quando o responsável assina o termo de tratamento.
            </p>
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {p.lgpd.pendentes_lista.map((x) => (
                <li key={x.id}>
                  <Link
                    to="/$clinica/pacientes/$id"
                    params={{ clinica, id: x.id }}
                    search={{ aba: "familia" }}
                    className="flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-sm hover:border-primary/40 hover:bg-surface"
                  >
                    <span className="truncate font-medium">{x.nome}</span>
                    <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-xs", x.status === "revogado" ? "bg-destructive/10 text-destructive" : "bg-warning/20 text-warning-foreground")}>
                      {x.status === "revogado" ? "Revogado" : "Pendente"}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {/* Equipe */}
      <section className="rounded-2xl border bg-card p-5">
        <header className="mb-3 flex flex-wrap items-center gap-2">
          <KeyRound className="size-5 text-primary" />
          <h2 className="text-base font-semibold">Acesso da equipe</h2>
          <span className="text-sm text-muted-foreground">
            {p.equipe.ativos} ativas · {p.equipe.sem_2fa} sem 2 etapas · {p.equipe.senha_temporaria} com senha temporária
          </span>
        </header>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr>
                <th className="py-2 pr-3 font-medium">Pessoa</th>
                <th className="py-2 pr-3 font-medium">Perfil</th>
                <th className="py-2 pr-3 font-medium">2 etapas</th>
                <th className="py-2 pr-3 font-medium">Senha</th>
                <th className="py-2 font-medium">Último login</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {p.equipe.contas.map((m) => (
                <tr key={m.id} className={cn(!m.ativo && "text-muted-foreground")}>
                  <td className="py-2 pr-3 font-medium">
                    {m.nome}
                    {!m.ativo && (
                      <span className="ml-2 inline-flex items-center gap-1 rounded bg-muted px-1.5 text-[10px] uppercase">
                        <UserX className="size-3" /> inativa
                      </span>
                    )}
                  </td>
                  <td className="py-2 pr-3">{m.papeis.map(nomePapel).join(" · ") || "—"}</td>
                  <td className="py-2 pr-3">
                    <Selo ok={m.tem_2fa} sim="Ativa" nao="Não cadastrada" />
                  </td>
                  <td className="py-2 pr-3">
                    <Selo ok={!m.senha_temporaria} sim="Própria" nao="Temporária" />
                  </td>
                  <td className="py-2">{m.ultimo_acesso ? fmtData(m.ultimo_acesso, "dd/MM/yyyy HH:mm") : "Nunca"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Banco e integridade */}
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border bg-card p-5">
          <header className="mb-3 flex items-center gap-2">
            <Database className="size-5 text-primary" />
            <h2 className="text-base font-semibold">Banco de dados</h2>
          </header>
          <ul className="space-y-2 text-sm">
            <Linha ok={p.banco.tabelas_sem_rls.length === 0} texto="Regras de acesso ativas em todas as tabelas" />
            <Linha ok={p.banco.views_sem_invoker.length === 0} texto="Consultas de indicadores respeitam o perfil de quem consulta" />
            <Linha ok={p.banco.buckets_publicos.length === 0} texto="Nenhum local de arquivos público" />
            <Linha ok={p.banco.funcoes_anonimas === 0} texto="Nenhuma função acessível sem login" />
            <Linha ok={p.banco.auditoria_imutavel} texto="Trilha de auditoria somente inclusão" />
            <Linha ok={p.banco.evolucao_imutavel && p.banco.evolucao_sem_exclusao} texto="Evoluções assinadas não podem ser alteradas nem apagadas" />
            <Linha ok={p.banco.adendo_imutavel} texto="Adendos não podem ser alterados nem apagados" />
          </ul>
        </section>
        <section className="rounded-2xl border bg-card p-5">
          <header className="mb-3 flex items-center gap-2">
            <ScrollText className="size-5 text-primary" />
            <h2 className="text-base font-semibold">Atividade e retenção (30 dias)</h2>
          </header>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <Numero rotulo="Logins" valor={p.auditoria.logins_30d} />
            <Numero rotulo="Saídas por inatividade" valor={p.auditoria.saidas_inatividade_30d} />
            <Numero rotulo="Exclusões registradas" valor={p.auditoria.exclusoes_30d} />
            <Numero rotulo="Adendos no prontuário" valor={p.integridade.adendos} />
            <Numero rotulo="Registros excluídos guardados" valor={totalExcluidos} />
            <Numero rotulo="Sessões finalizadas sem evolução" valor={p.integridade.finalizadas_sem_evolucao} />
          </dl>
          <Button asChild variant="outline" size="sm" className="mt-4">
            <Link to="/$clinica/seguranca/auditoria" params={{ clinica }}>
              <ScrollText /> Abrir trilha de auditoria
            </Link>
          </Button>
        </section>
      </div>
    </div>
  );
}

function Cartao({ titulo, valor, detalhe, tom, destaque }: { titulo: string; valor: string; detalhe: string; tom?: Situacao; destaque?: boolean }) {
  return (
    <div className={cn("rounded-2xl border bg-card p-4", destaque && "border-primary/30 bg-secondary/40")}>
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{titulo}</div>
      <div className={cn("mt-1 font-display text-3xl font-semibold", tom && ESTILO[tom].cor)}>{valor}</div>
      <div className="text-xs text-muted-foreground">{detalhe}</div>
    </div>
  );
}

function Selo({ ok, sim, nao }: { ok: boolean; sim: string; nao: string }) {
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", ok ? "bg-success/15 text-success" : "bg-warning/20 text-warning-foreground")}>
      {ok ? sim : nao}
    </span>
  );
}

function Linha({ ok, texto }: { ok: boolean; texto: string }) {
  const e = ESTILO[ok ? "ok" : "critico"];
  return (
    <li className="flex items-center gap-2">
      <e.icon className={cn("size-4 shrink-0", e.cor)} aria-label={e.rotulo} />
      {texto}
    </li>
  );
}

function Numero({ rotulo, valor }: { rotulo: string; valor: number }) {
  return (
    <div className="rounded-xl bg-surface p-3">
      <dt className="text-xs text-muted-foreground">{rotulo}</dt>
      <dd className="font-display text-xl font-semibold">{valor}</dd>
    </div>
  );
}
