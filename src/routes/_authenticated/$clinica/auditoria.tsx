import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { format, subDays } from "date-fns";
import { ChevronDown } from "lucide-react";
import { z } from "zod";
import {
  LIMITE_AUDITORIA,
  auditoriaQuery,
  conveniosQuery,
  equipeQuery,
  especialidadesQuery,
  meQuery,
  pacientesOpcoesQuery,
  salasQuery,
} from "@/lib/queries";
import { useMe } from "@/hooks/use-me";
import { PAPEIS, podeVerAuditoria, veAuditoriaDoProntuario } from "@/lib/permissions";
import {
  ACOES_AUDITORIA,
  AREAS_AUDITORIA,
  areasVisiveis,
  camposVisiveis,
  formatarValorAuditoria,
  rotuloCampo,
} from "@/lib/auditoria";
import { STATUS_AGENDA, fmtData } from "@/lib/ui-helpers";
import { rotuloTipoConvenio, TIPOS_CONVENIO } from "@/lib/convenios";
import { PageHeader } from "@/components/PageHeader";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const hoje = () => format(new Date(), "yyyy-MM-dd");
const semanaPassada = () => format(subDays(new Date(), 6), "yyyy-MM-dd");
const dia = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const TODOS = "todos";

export const Route = createFileRoute("/_authenticated/$clinica/auditoria")({
  validateSearch: z.object({
    de: dia.optional(),
    ate: dia.optional(),
    usuario: z.string().optional(),
    area: z.string().optional(),
    acao: z.string().optional(),
  }),
  loaderDeps: ({ search }) => ({
    de: search.de ?? semanaPassada(),
    ate: search.ate ?? hoje(),
    usuario: search.usuario,
    area: search.area,
    acao: search.acao,
  }),
  beforeLoad: async ({ context, params }) => {
    const me = await context.queryClient.ensureQueryData(meQuery);
    if (!podeVerAuditoria(me.papeis)) throw redirect({ to: "/$clinica/painel", params });
  },
  loader: async ({ context, deps }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(auditoriaQuery(deps)),
      context.queryClient.ensureQueryData(equipeQuery),
      context.queryClient.ensureQueryData(salasQuery),
      context.queryClient.ensureQueryData(especialidadesQuery),
      context.queryClient.ensureQueryData(conveniosQuery),
      context.queryClient.ensureQueryData(pacientesOpcoesQuery),
    ]);
  },
  head: () => ({ meta: [{ title: "Auditoria — CliniHelp" }] }),
  component: AuditoriaPage,
  errorComponent: ({ error }) => (
    <div role="alert" className="rounded-2xl border bg-card p-6 text-sm">
      <p className="font-medium">Não foi possível carregar a auditoria.</p>
      <p className="mt-1 text-muted-foreground">{error instanceof Error ? error.message : String(error)}</p>
    </div>
  ),
});

const TOM: Record<string, string> = {
  criou: "bg-success/15 text-success",
  alterou: "bg-secondary text-secondary-foreground",
  removeu: "bg-destructive/10 text-destructive",
  neutro: "bg-muted text-muted-foreground",
};

function AuditoriaPage() {
  const me = useMe();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const filtro = Route.useLoaderDeps();
  const { data: registros } = useSuspenseQuery(auditoriaQuery(filtro));
  const { data: equipe } = useSuspenseQuery(equipeQuery);
  const { data: salas } = useSuspenseQuery(salasQuery);
  const { data: especialidades } = useSuspenseQuery(especialidadesQuery);
  const { data: convenios } = useSuspenseQuery(conveniosQuery);
  const { data: pacientes } = useSuspenseQuery(pacientesOpcoesQuery);

  /** Troca ids e códigos gravados por nomes legíveis. */
  const nomes = useMemo(() => {
    const m = new Map<string, string>();
    for (const x of [...equipe, ...salas, ...especialidades, ...convenios, ...pacientes]) m.set(x.id, x.nome);
    for (const p of PAPEIS) m.set(p.value, p.label);
    for (const [k, v] of Object.entries(STATUS_AGENDA)) m.set(k, v.label);
    for (const t of TIPOS_CONVENIO) m.set(t.value, t.label);
    m.set("pago", "Pago");
    m.set("pendente", "Pendente");
    return m;
  }, [equipe, salas, especialidades, convenios, pacientes]);

  const setFiltro = (k: keyof typeof search, v: string | undefined) =>
    navigate({ search: (s) => ({ ...s, [k]: v && v !== TODOS ? v : undefined }) });

  return (
    <div>
      <PageHeader titulo="Auditoria" descricao="Os logs do Sistema estão aqui. Os registros não podem ser alterados nem apagados." />

      <div className="mb-5 flex flex-wrap items-end gap-2">
        <label className="grid gap-1 text-xs text-muted-foreground">
          De
          <Input type="date" value={filtro.de} max={filtro.ate} onChange={(e) => e.target.value && setFiltro("de", e.target.value)} className="w-auto" />
        </label>
        <label className="grid gap-1 text-xs text-muted-foreground">
          Até
          <Input type="date" value={filtro.ate} min={filtro.de} onChange={(e) => e.target.value && setFiltro("ate", e.target.value)} className="w-auto" />
        </label>
        <Select value={search.usuario ?? TODOS} onValueChange={(v) => setFiltro("usuario", v)}>
          <SelectTrigger className="w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todos os usuários</SelectItem>
            {equipe.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={search.area ?? TODOS} onValueChange={(v) => setFiltro("area", v)}>
          <SelectTrigger className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todas as áreas</SelectItem>
            {areasVisiveis(veAuditoriaDoProntuario(me.papeis)).map(([k, label]) => (
              <SelectItem key={k} value={k}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={search.acao ?? TODOS} onValueChange={(v) => setFiltro("acao", v)}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todas as ações</SelectItem>
            {Object.entries(ACOES_AUDITORIA).map(([k, a]) => (
              <SelectItem key={k} value={k}>
                {a.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <p className="mb-3 text-xs text-muted-foreground">
        {registros.length === LIMITE_AUDITORIA
          ? `Mostrando os ${LIMITE_AUDITORIA} registros mais recentes. Use os filtros para refinar.`
          : `${registros.length} ${registros.length === 1 ? "registro" : "registros"} no período.`}
      </p>

      <div className="divide-y overflow-hidden rounded-2xl border bg-card">
        {registros.length === 0 && <div className="p-8 text-center text-sm text-muted-foreground">Nenhum registro no período.</div>}
        {registros.map((r) => {
          const acao = ACOES_AUDITORIA[r.acao] ?? { label: r.acao, tom: "neutro" as const };
          const antes = (r.antes ?? {}) as Record<string, unknown>;
          const depois = (r.depois ?? {}) as Record<string, unknown>;
          const campos =
            r.acao === "alterou"
              ? (r.campos ?? []).filter((k) => camposVisiveis({ [k]: 1 }).length)
              : camposVisiveis(r.acao === "removeu" ? antes : depois);
          const temDetalhe = campos.length > 0;
          const linha = (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 p-3 text-sm">
              <div className="w-32 shrink-0 text-xs text-muted-foreground">{fmtData(r.created_at, "dd/MM/yyyy HH:mm")}</div>
              <div className="w-40 shrink-0 truncate font-medium">{r.usuario_nome ?? "Sistema"}</div>
              <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", TOM[acao.tom])}>{acao.label}</span>
              <span className="text-xs text-muted-foreground">{AREAS_AUDITORIA[r.tabela] ?? r.tabela}</span>
              <span className="min-w-0 flex-1 truncate">
                {r.tabela === "convenios" && depois["tipo"] ? `${r.descricao} · ${rotuloTipoConvenio(String(depois["tipo"]))}` : r.descricao}
              </span>
              {temDetalhe && <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />}
            </div>
          );
          if (!temDetalhe) return <div key={r.id}>{linha}</div>;
          return (
            <details key={r.id} className="group">
              <summary className="cursor-pointer list-none hover:bg-surface [&::-webkit-details-marker]:hidden">{linha}</summary>
              <div className="bg-surface/60 px-3 pb-3 pt-1">
                <table className="w-full text-xs">
                  <thead className="text-left text-muted-foreground">
                    <tr>
                      <th className="py-1.5 pr-3 font-medium">Campo</th>
                      {r.acao !== "criou" && <th className="py-1.5 pr-3 font-medium">{r.acao === "alterou" ? "Antes" : "Valor"}</th>}
                      {r.acao !== "removeu" && <th className="py-1.5 font-medium">{r.acao === "alterou" ? "Depois" : "Valor"}</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {campos.map((k) => (
                      <tr key={k} className="align-top">
                        <td className="py-1.5 pr-3 text-muted-foreground">{rotuloCampo(k)}</td>
                        {r.acao !== "criou" && <td className="whitespace-pre-wrap py-1.5 pr-3">{formatarValorAuditoria(antes[k], nomes)}</td>}
                        {r.acao !== "removeu" && <td className="whitespace-pre-wrap py-1.5">{formatarValorAuditoria(depois[k], nomes)}</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          );
        })}
      </div>
    </div>
  );
}
