import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { endOfMonth, format, parseISO, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { z } from "zod";
import { toast } from "sonner";
import { Ban, Copy, ExternalLink, MessageCircle, MoreHorizontal, Plus, RefreshCw, Receipt } from "lucide-react";
import { cobrancasQuery, recebimentosAtivosQuery } from "@/lib/queries";
import { cancelarCobranca, sincronizarCobranca } from "@/lib/cobrancas.functions";
import { STATUS_COBRANCA, linkPagamento, mensagemWhatsapp, podeCancelar, rotuloForma, type StatusCobranca } from "@/lib/cobrancas";
import { formatarMoeda } from "@/lib/financeiro";
import { podeGerirFinanceiro } from "@/lib/permissions";
import { erroAmigavel, fmtData } from "@/lib/ui-helpers";
import { useMe } from "@/hooks/use-me";
import { PageHeader } from "@/components/PageHeader";
import { NovaCobrancaDialog } from "@/components/cobrancas/NovaCobrancaDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { meQuery } from "@/lib/queries";

const mesAtual = () => format(new Date(), "yyyy-MM");
const periodo = (mes: string) => {
  const ini = startOfMonth(parseISO(`${mes}-01`));
  return { ini, de: format(ini, "yyyy-MM-dd"), ate: format(endOfMonth(ini), "yyyy-MM-dd") };
};

export const Route = createFileRoute("/_authenticated/$clinica/cobrancas")({
  validateSearch: z.object({
    mes: z.string().regex(/^\d{4}-\d{2}$/).optional(),
    status: z.string().optional(),
  }),
  loaderDeps: ({ search }) => ({ mes: search.mes ?? mesAtual() }),
  loader: async ({ context, deps }) => {
    const me = await context.queryClient.ensureQueryData(meQuery);
    const p = periodo(deps.mes);
    await Promise.all([
      context.queryClient.ensureQueryData(cobrancasQuery(p.de, p.ate)),
      me.clinica && context.queryClient.ensureQueryData(recebimentosAtivosQuery(me.clinica.id)),
    ]);
  },
  head: () => ({ meta: [{ title: "Cobranças — CliniHelp" }] }),
  component: CobrancasPage,
});

function CobrancasPage() {
  const me = useMe();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const qc = useQueryClient();
  const mes = search.mes ?? mesAtual();
  const filtroStatus = search.status ?? "todas";
  const p = periodo(mes);
  const { data: cobrancas } = useSuspenseQuery(cobrancasQuery(p.de, p.ate));
  const { data: ativos } = useSuspenseQuery(recebimentosAtivosQuery(me.clinica!.id));
  const sincronizar = useServerFn(sincronizarCobranca);
  const cancelar = useServerFn(cancelarCobranca);
  const [novaAberta, setNovaAberta] = useState(false);
  const [paraCancelar, setParaCancelar] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);

  const lista = cobrancas.filter((c) => filtroStatus === "todas" || c.status === filtroStatus);
  const totais = useMemo(() => {
    const ativas = cobrancas.filter((c) => c.status !== "cancelada");
    const soma = (f: (c: (typeof cobrancas)[number]) => boolean) => ativas.filter(f).reduce((t, c) => t + Number(c.valor), 0);
    return {
      emitido: soma(() => true),
      recebido: soma((c) => c.status === "pago"),
      aguardando: soma((c) => c.status === "pendente" || c.status === "em_analise"),
      vencido: soma((c) => c.status === "vencido"),
    };
  }, [cobrancas]);

  if (!podeGerirFinanceiro(me.papeis)) {
    return <p className="text-sm text-muted-foreground">Seu perfil não tem acesso às cobranças.</p>;
  }

  const atualizarLista = () => qc.invalidateQueries({ queryKey: ["cobrancas"] });

  async function verificar(id: string) {
    setOcupado(id);
    try {
      const r = await sincronizar({ data: { id } });
      toast.success(`Situação: ${STATUS_COBRANCA[r.status].label}`);
      atualizarLista();
      qc.invalidateQueries({ queryKey: ["financeiro"] });
    } catch (e) {
      toast.error(erroAmigavel((e as Error).message));
    } finally {
      setOcupado(null);
    }
  }

  async function confirmarCancelamento() {
    if (!paraCancelar) return;
    const id = paraCancelar;
    setParaCancelar(null);
    setOcupado(id);
    try {
      await cancelar({ data: { id } });
      toast.success("Cobrança cancelada");
      atualizarLista();
    } catch (e) {
      toast.error(erroAmigavel((e as Error).message));
    } finally {
      setOcupado(null);
    }
  }

  function copiar(token: string) {
    navigator.clipboard.writeText(linkPagamento(token)).then(
      () => toast.success("Link copiado"),
      () => toast.error("Não foi possível copiar"),
    );
  }

  function whatsapp(c: (typeof cobrancas)[number]) {
    const tel = (c.pagador_telefone ?? "").replace(/\D/g, "");
    const texto = mensagemWhatsapp(me.clinica!.nome, c.descricao, formatarMoeda(Number(c.valor)), linkPagamento(c.token_publico));
    const destino = tel ? `55${tel.replace(/^55/, "")}` : "";
    window.open(`https://wa.me/${destino}?text=${encodeURIComponent(texto)}`, "_blank", "noopener");
  }

  if (!ativos) {
    return (
      <div>
        <PageHeader titulo="Cobranças" />
        <div className="mx-auto max-w-lg rounded-2xl border border-dashed p-10 text-center">
          <Receipt className="mx-auto size-10 text-muted-foreground" />
          <h2 className="mt-4 text-lg font-semibold">Recebimentos ainda não ativados</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Para cobrar os responsáveis por Pix, boleto e cartão, a conta de recebimento da clínica precisa ser ativada. Fale com o suporte CliniHelp.
          </p>
        </div>
      </div>
    );
  }

  const cards = [
    { label: "Emitido", v: totais.emitido },
    { label: "Recebido", v: totais.recebido, destaque: true },
    { label: "Aguardando", v: totais.aguardando },
    { label: "Vencido", v: totais.vencido },
  ];

  return (
    <div>
      <PageHeader
        titulo="Cobranças"
        descricao={`Vencimentos de ${format(p.ini, "MMMM 'de' yyyy", { locale: ptBR })}`}
        acoes={
          <Button onClick={() => setNovaAberta(true)}>
            <Plus /> Nova cobrança
          </Button>
        }
      />

      <div className="mb-5 flex flex-wrap gap-2">
        <Input type="month" value={mes} onChange={(e) => e.target.value && navigate({ search: (s) => ({ ...s, mes: e.target.value }) })} className="w-auto" />
        <Select value={filtroStatus} onValueChange={(v) => navigate({ search: (s) => ({ ...s, status: v === "todas" ? undefined : v }) })}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas</SelectItem>
            {Object.entries(STATUS_COBRANCA).map(([k, s]) => (
              <SelectItem key={k} value={k}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className={cn("rounded-2xl border p-4", c.destaque ? "border-primary/30 bg-primary text-primary-foreground" : "bg-card")}>
            <div className={cn("text-xs", c.destaque ? "text-primary-foreground/80" : "text-muted-foreground")}>{c.label}</div>
            <div className="mt-1 font-display text-xl font-semibold md:text-2xl">{formatarMoeda(c.v)}</div>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto rounded-2xl border bg-card">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-surface text-left text-xs text-muted-foreground">
            <tr>
              <th className="p-3">Vencimento</th>
              <th className="p-3">Paciente / descrição</th>
              <th className="p-3">Pagador</th>
              <th className="p-3">Forma</th>
              <th className="p-3 text-right">Valor</th>
              <th className="p-3">Situação</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {lista.length === 0 && (
              <tr>
                <td colSpan={7} className="p-8 text-center text-muted-foreground">
                  Nenhuma cobrança neste mês.
                </td>
              </tr>
            )}
            {lista.map((c) => {
              const st = STATUS_COBRANCA[c.status as StatusCobranca];
              return (
                <tr key={c.id} className={cn(ocupado === c.id && "opacity-60")}>
                  <td className="whitespace-nowrap p-3">{fmtData(`${c.vencimento}T12:00:00`, "dd/MM/yyyy")}</td>
                  <td className="p-3">
                    <div className="font-medium">{c.paciente?.nome}</div>
                    <div className="text-xs text-muted-foreground">
                      {c.descricao}
                      {c.itens.length > 0 && ` · ${c.itens.length} sessão(ões)`}
                    </div>
                  </td>
                  <td className="p-3">{c.pagador_nome}</td>
                  <td className="p-3 text-muted-foreground">{rotuloForma(c.forma)}</td>
                  <td className="whitespace-nowrap p-3 text-right font-medium">{formatarMoeda(Number(c.valor))}</td>
                  <td className="p-3">
                    <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", st.className)}>{st.label}</span>
                    {c.status === "pago" && c.pago_em && <div className="mt-1 text-xs text-muted-foreground">em {fmtData(c.pago_em, "dd/MM")}</div>}
                  </td>
                  <td className="p-3 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" aria-label="Ações da cobrança" disabled={ocupado === c.id}>
                          <MoreHorizontal />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => copiar(c.token_publico)}>
                          <Copy /> Copiar link de pagamento
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => whatsapp(c)}>
                          <MessageCircle /> Enviar por WhatsApp
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => window.open(linkPagamento(c.token_publico), "_blank", "noopener")}>
                          <ExternalLink /> Abrir página de pagamento
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => verificar(c.id)}>
                          <RefreshCw /> Verificar pagamento
                        </DropdownMenuItem>
                        {podeCancelar(c.status as StatusCobranca) && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive" onSelect={() => setParaCancelar(c.id)}>
                              <Ban /> Cancelar cobrança
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Quando o responsável paga, a cobrança e as sessões ligadas a ela ficam como pagas no Financeiro automaticamente.
      </p>

      <NovaCobrancaDialog aberta={novaAberta} onClose={() => setNovaAberta(false)} onCriada={() => atualizarLista()} />

      <AlertDialog open={!!paraCancelar} onOpenChange={(v) => !v && setParaCancelar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar esta cobrança?</AlertDialogTitle>
            <AlertDialogDescription>O link deixa de funcionar e as sessões ficam livres para uma nova cobrança.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmarCancelamento}>Cancelar cobrança</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
