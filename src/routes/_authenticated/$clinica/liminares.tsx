import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { addMonths, format, parseISO, startOfMonth } from "date-fns";
import { z } from "zod";
import { toast } from "sonner";
import { AlertTriangle, FileText, Loader2, Lock, MoreVertical, Receipt, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { conveniosQuery, faturasLiminarQuery, meQuery, sessoesLiminarQuery, type FaturaLiminar, type SessaoLiminar } from "@/lib/queries";
import { useMe } from "@/hooks/use-me";
import { podeGerirFinanceiro } from "@/lib/permissions";
import { competenciaDe, diasParaVencer, resumoLiminar, SITUACAO_FATURA, sessoesForaDoFechamento, situacaoFatura } from "@/lib/liminar";
import { gerarListaPresenca, nomeMes } from "@/lib/lista-presenca";
import { formatarMoeda } from "@/lib/financeiro";
import { erroAmigavel } from "@/lib/ui-helpers";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/PageHeader";
import { NfDialog, PagamentoDialog, useInvalidarLiminar } from "@/components/liminar/FaturaDialogs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const mesAtual = () => format(new Date(), "yyyy-MM");
const hojeISO = () => format(new Date(), "yyyy-MM-dd");
const br = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/");

function intervaloMes(mes: string) {
  const ini = startOfMonth(parseISO(`${mes}-01`));
  return [ini.toISOString(), addMonths(ini, 1).toISOString()] as const;
}

export const Route = createFileRoute("/_authenticated/$clinica/liminares")({
  validateSearch: z.object({ mes: z.string().regex(/^\d{4}-\d{2}$/).optional() }),
  beforeLoad: async ({ context, params }) => {
    const me = await context.queryClient.ensureQueryData(meQuery);
    if (!podeGerirFinanceiro(me.papeis)) throw redirect({ to: "/$clinica/painel", params });
  },
  loaderDeps: ({ search }) => ({ mes: search.mes ?? mesAtual() }),
  loader: ({ context, deps }) => {
    const [a, b] = intervaloMes(deps.mes);
    return Promise.all([
      context.queryClient.ensureQueryData(conveniosQuery),
      context.queryClient.ensureQueryData(faturasLiminarQuery),
      context.queryClient.ensureQueryData(sessoesLiminarQuery(a, b)),
    ]);
  },
  head: () => ({
    meta: [
      { title: "Liminares — CliniHelp" },
      { name: "description", content: "Fechamento mensal das liminares: lista de presença, nota fiscal e pagamento em 30 dias." },
    ],
  }),
  component: LiminaresPage,
});

type Grupo = {
  pacienteId: string;
  nome: string;
  convenioId: string | null;
  sessoes: SessaoLiminar[];
  fatura: FaturaLiminar | null;
};

function LiminaresPage() {
  const me = useMe();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const invalidar = useInvalidarLiminar();
  const mes = search.mes ?? mesAtual();
  const [a, b] = intervaloMes(mes);
  const hoje = hojeISO();

  const { data: convenios } = useSuspenseQuery(conveniosQuery);
  const { data: faturas } = useSuspenseQuery(faturasLiminarQuery);
  const { data: sessoes } = useSuspenseQuery(sessoesLiminarQuery(a, b));

  const [nfAberta, setNfAberta] = useState<FaturaLiminar | null>(null);
  const [pgAberto, setPgAberto] = useState<FaturaLiminar | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);

  const nomeConvenio = useMemo(() => new Map(convenios.map((c) => [c.id, c.nome])), [convenios]);
  const competencia = competenciaDe(mes);

  const grupos = useMemo(() => {
    const liminar = new Set(convenios.filter((c) => c.tipo === "liminar").map((c) => c.id));
    const m = new Map<string, Grupo>();
    const doMes = faturas.filter((f) => f.competencia === competencia);
    const faturaIds = new Set(doMes.map((f) => f.id));
    for (const s of sessoes) {
      // Entra quem é liminar hoje ou já está num fechamento deste mês (mesmo que o plano tenha mudado depois).
      if (!liminar.has(s.paciente?.convenio_id ?? "") && !(s.item && faturaIds.has(s.item.fatura_id))) continue;
      const g = m.get(s.paciente_id) ?? { pacienteId: s.paciente_id, nome: s.paciente?.nome ?? "", convenioId: s.paciente?.convenio_id ?? null, sessoes: [], fatura: null };
      g.sessoes.push(s);
      m.set(s.paciente_id, g);
    }
    for (const f of doMes) {
      const g = m.get(f.paciente_id) ?? { pacienteId: f.paciente_id, nome: f.paciente?.nome ?? "", convenioId: f.convenio_id, sessoes: [], fatura: null };
      g.fatura = f;
      g.convenioId = f.convenio_id;
      m.set(f.paciente_id, g);
    }
    return [...m.values()].sort((x, y) => x.nome.localeCompare(y.nome));
  }, [convenios, faturas, sessoes, competencia]);

  const resumo = useMemo(() => resumoLiminar(faturas, hoje, mes), [faturas, hoje, mes]);
  const pendentes = useMemo(
    () =>
      faturas
        .filter((f) => f.status !== "paga")
        .sort((x, y) => (x.vencimento ?? "9999").localeCompare(y.vencimento ?? "9999") || x.competencia.localeCompare(y.competencia)),
    [faturas],
  );

  async function fechar(g: Grupo) {
    const fora = sessoesForaDoFechamento(g.sessoes);
    if (!fora.length) return void toast.info("Não há sessões novas para incluir.");
    if (!g.convenioId) return void toast.error("O paciente está sem convênio no cadastro.");
    setOcupado(g.pacienteId);
    let faturaId = g.fatura?.id;
    if (!faturaId) {
      const { data, error } = await supabase
        .from("faturas_liminar")
        .insert({ paciente_id: g.pacienteId, convenio_id: g.convenioId, competencia })
        .select("id")
        .single();
      if (error) {
        setOcupado(null);
        return void toast.error(erroAmigavel(error.message));
      }
      faturaId = data.id;
    }
    const { error } = await supabase.from("fatura_liminar_itens").insert(fora.map((s) => ({ agendamento_id: s.id, fatura_id: faturaId! })));
    setOcupado(null);
    if (error) return void toast.error(erroAmigavel(error.message));
    toast.success(g.fatura ? `${fora.length} ${fora.length === 1 ? "sessão incluída" : "sessões incluídas"} no fechamento.` : `Mês fechado para ${g.nome}. Agora informe a nota fiscal.`);
    invalidar();
  }

  async function desfazerFechamento(f: FaturaLiminar) {
    if (!confirm(`Desfazer o fechamento de ${f.paciente?.nome}? As sessões voltam a ficar em aberto.`)) return;
    const { error } = await supabase.from("faturas_liminar").delete().eq("id", f.id);
    if (error) return void toast.error(erroAmigavel(error.message));
    toast.success("Fechamento desfeito.");
    invalidar();
  }

  async function desfazerPagamento(f: FaturaLiminar) {
    if (!confirm("Desfazer o pagamento? As sessões voltam a ficar pendentes.")) return;
    const { error } = await supabase.from("faturas_liminar").update({ status: "nf_emitida", pago_em: null, valor_pago: null }).eq("id", f.id);
    if (error) return void toast.error(erroAmigavel(error.message));
    toast.success("Pagamento desfeito.");
    invalidar();
  }

  async function baixarLista(g: Grupo) {
    const lista = g.fatura ? g.sessoes.filter((s) => s.item?.fatura_id === g.fatura!.id) : g.sessoes;
    const p = g.sessoes[0]?.paciente;
    if (!lista.length || !p) return void toast.info("Nenhuma sessão realizada para listar.");
    try {
      await gerarListaPresenca({
        clinica: me.clinica?.nome ?? "Clínica",
        mes,
        convenio: g.convenioId ? (nomeConvenio.get(g.convenioId) ?? "") : "",
        paciente: p,
        sessoes: lista.map((s) => ({
          inicio: s.inicio,
          fim: s.fim,
          especialidade: s.especialidade?.nome ?? "",
          profissional: s.profissional?.nome ?? "",
          registro: [s.profissional?.conselho, s.profissional?.registro_profissional].filter(Boolean).join(" ") || null,
        })),
        nf: g.fatura?.nf_numero && g.fatura.nf_emissao && g.fatura.vencimento ? { numero: g.fatura.nf_numero, emissao: g.fatura.nf_emissao, vencimento: g.fatura.vencimento } : null,
      });
    } catch {
      toast.error("Não foi possível gerar a lista. Tente novamente.");
    }
  }

  return (
    <div>
      <PageHeader titulo="Liminares" descricao="Fechamento do mês com lista de presença e nota fiscal · pagamento 30 dias após a emissão" />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Resumo label="Aguardando NF" valor={resumo.aguardandoNf.valor} sub={`${resumo.aguardandoNf.n} ${resumo.aguardandoNf.n === 1 ? "fechamento" : "fechamentos"}`} tom="alerta" />
        <Resumo label="A receber" valor={resumo.aReceber.valor} sub={`${resumo.aReceber.n} ${resumo.aReceber.n === 1 ? "nota" : "notas"} · ${formatarMoeda(resumo.venceEm7.valor)} vence em 7 dias`} destaque />
        <Resumo label="Vencidas" valor={resumo.vencidas.valor} sub={`${resumo.vencidas.n} ${resumo.vencidas.n === 1 ? "nota" : "notas"}`} tom={resumo.vencidas.n ? "perigo" : undefined} />
        <Resumo label={`Recebido em ${nomeMes(mes).split(" ")[0]}`} valor={resumo.recebidoNoMes.valor} sub={`${resumo.recebidoNoMes.n} ${resumo.recebidoNoMes.n === 1 ? "nota" : "notas"}`} />
      </div>

      <section className="mb-8">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">Fechamento de {nomeMes(mes)}</h2>
          <Input type="month" value={mes} onChange={(e) => e.target.value && navigate({ search: { mes: e.target.value } })} className="w-auto" aria-label="Mês do fechamento" />
        </div>

        {grupos.length === 0 ? (
          <p className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            Nenhuma sessão realizada de paciente com liminar neste mês.
            {!convenios.some((c) => c.tipo === "liminar") && " Cadastre um plano do tipo Liminar na tabela de convênios (página Financeiro)."}
          </p>
        ) : (
          <ul className="grid gap-3">
            {grupos.map((g) => {
              const f = g.fatura;
              const fora = sessoesForaDoFechamento(g.sessoes);
              const valorAberto = g.sessoes.reduce((s, x) => s + Number(x.fin?.valor ?? 0), 0);
              const sit = f ? situacaoFatura(f, hoje) : null;
              return (
                <li key={g.pacienteId} className="rounded-2xl border bg-card p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold">{g.nome}</span>
                        {sit ? (
                          <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", SITUACAO_FATURA[sit].className)}>{SITUACAO_FATURA[sit].label}</span>
                        ) : (
                          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">Mês em aberto</span>
                        )}
                      </div>
                      <div className="mt-0.5 text-sm text-muted-foreground">
                        {g.convenioId ? nomeConvenio.get(g.convenioId) : "Sem convênio"} ·{" "}
                        {f ? `${f.quantidade_sessoes} ${f.quantidade_sessoes === 1 ? "sessão" : "sessões"} · ${formatarMoeda(f.valor)}` : `${g.sessoes.length} ${g.sessoes.length === 1 ? "sessão realizada" : "sessões realizadas"} · ${formatarMoeda(valorAberto)}`}
                      </div>
                      {f?.nf_numero && (
                        <div className="mt-1 text-sm">
                          NF <strong>{f.nf_numero}</strong> · emitida {br(f.nf_emissao!)} · vence <strong>{br(f.vencimento!)}</strong>
                          {f.status === "paga" && f.pago_em && <span className="text-success"> · paga em {br(f.pago_em)} ({formatarMoeda(f.valor_pago ?? f.valor)})</span>}
                        </div>
                      )}
                      {f && fora.length > 0 && (
                        <div className="mt-1 flex items-center gap-1.5 text-sm text-warning-foreground">
                          <AlertTriangle className="size-3.5 shrink-0" />
                          {fora.length} {fora.length === 1 ? "sessão realizada ficou fora" : "sessões realizadas ficaram fora"} do fechamento
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => baixarLista(g)}>
                        <FileText /> Lista de presença
                      </Button>
                      {!f && (
                        <Button size="sm" onClick={() => fechar(g)} disabled={ocupado === g.pacienteId || g.sessoes.length === 0}>
                          {ocupado === g.pacienteId ? <Loader2 className="animate-spin" /> : <Lock />} Fechar mês
                        </Button>
                      )}
                      {f?.status === "aguardando_nf" && (
                        <Button size="sm" onClick={() => setNfAberta(f)}>
                          <Receipt /> Informar NF
                        </Button>
                      )}
                      {f?.status === "nf_emitida" && (
                        <Button size="sm" onClick={() => setPgAberto(f)}>
                          <Wallet /> Registrar pagamento
                        </Button>
                      )}
                      {f && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" aria-label={`Mais ações de ${g.nome}`}>
                              <MoreVertical />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {f.status !== "paga" && fora.length > 0 && <DropdownMenuItem onSelect={() => fechar(g)}>Incluir sessões que ficaram fora</DropdownMenuItem>}
                            {f.status !== "aguardando_nf" && <DropdownMenuItem onSelect={() => setNfAberta(f)}>Editar nota fiscal</DropdownMenuItem>}
                            {f.status === "paga" && <DropdownMenuItem onSelect={() => desfazerPagamento(f)}>Desfazer pagamento</DropdownMenuItem>}
                            {f.status !== "paga" && (
                              <DropdownMenuItem className="text-destructive" onSelect={() => desfazerFechamento(f)}>
                                Desfazer fechamento
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-semibold">Pendências de todos os meses</h2>
        {pendentes.length === 0 ? (
          <p className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">Nenhuma nota aguardando emissão ou pagamento.</p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border bg-card">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-surface text-left text-xs text-muted-foreground">
                <tr>
                  <th className="p-3">Paciente</th>
                  <th className="p-3">Competência</th>
                  <th className="p-3">NF</th>
                  <th className="p-3">Vencimento</th>
                  <th className="p-3 text-right">Valor</th>
                  <th className="p-3" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {pendentes.map((f) => {
                  const sit = situacaoFatura(f, hoje);
                  const dias = f.vencimento ? diasParaVencer(f.vencimento, hoje) : null;
                  return (
                    <tr key={f.id} className={cn(sit === "vencida" && "bg-destructive/5")}>
                      <td className="p-3">
                        <div className="font-medium">{f.paciente?.nome}</div>
                        <div className="text-xs text-muted-foreground">{f.convenio?.nome}</div>
                      </td>
                      <td className="p-3 capitalize">
                        <button className="hover:underline" onClick={() => navigate({ search: { mes: f.competencia.slice(0, 7) } })}>
                          {nomeMes(f.competencia.slice(0, 7))}
                        </button>
                      </td>
                      <td className="p-3">{f.nf_numero ? `${f.nf_numero} · ${br(f.nf_emissao!)}` : <span className="text-warning-foreground">Não emitida</span>}</td>
                      <td className="p-3">
                        {f.vencimento ? (
                          <>
                            <div>{br(f.vencimento)}</div>
                            <div className={cn("text-xs", sit === "vencida" ? "text-destructive" : "text-muted-foreground")}>
                              {dias === 0 ? "vence hoje" : dias! > 0 ? `em ${dias} ${dias === 1 ? "dia" : "dias"}` : `vencida há ${-dias!} ${dias === -1 ? "dia" : "dias"}`}
                            </div>
                          </>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="whitespace-nowrap p-3 text-right font-medium">{formatarMoeda(f.valor)}</td>
                      <td className="p-3 text-right">
                        {f.status === "aguardando_nf" ? (
                          <Button size="sm" variant="outline" onClick={() => setNfAberta(f)}>
                            Informar NF
                          </Button>
                        ) : (
                          <Button size="sm" variant="outline" onClick={() => setPgAberto(f)}>
                            Registrar pagamento
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <NfDialog fatura={nfAberta} onOpenChange={(v) => !v && setNfAberta(null)} />
      <PagamentoDialog fatura={pgAberto} onOpenChange={(v) => !v && setPgAberto(null)} />
    </div>
  );
}

function Resumo({ label, valor, sub, destaque, tom }: { label: string; valor: number; sub: string; destaque?: boolean; tom?: "alerta" | "perigo" | undefined }) {
  return (
    <div
      className={cn(
        "rounded-2xl border p-4",
        destaque ? "border-primary/30 bg-primary text-primary-foreground" : tom === "perigo" ? "border-destructive/40 bg-destructive/5" : "bg-card",
      )}
    >
      <div className={cn("text-xs", destaque ? "text-primary-foreground/80" : "text-muted-foreground")}>{label}</div>
      <div className={cn("mt-1 font-display text-xl font-semibold md:text-2xl", tom === "perigo" && "text-destructive")}>{formatarMoeda(valor)}</div>
      <div className={cn("text-xs", destaque ? "text-primary-foreground/80" : "text-muted-foreground")}>{sub}</div>
    </div>
  );
}
