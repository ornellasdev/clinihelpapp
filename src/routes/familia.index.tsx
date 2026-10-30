import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { queryOptions, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Suspense, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { CalendarDays, CheckCircle2, FileDown, FileSignature, Loader2, LogOut, Receipt, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { baixarRelatorioFamilia, comprovanteTermoFamilia } from "@/lib/familia.functions";
import { ROTULO_DECISAO, type Decisao } from "@/lib/familia";
import { STATUS_COBRANCA, podePagar, rotuloForma, type StatusCobranca } from "@/lib/cobrancas";
import { formatarMoeda } from "@/lib/financeiro";
import { STATUS_AGENDA, corEsp, fmtData, fmtHora, idade, type StatusAgenda } from "@/lib/ui-helpers";
import { MolduraFamilia } from "./familia";
import { AssinarTermoDialog, type TermoFamilia } from "@/components/familia/AssinarTermoDialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

const ok = <T,>(r: { data: T | null; error: { message: string } | null }) => {
  if (r.error) throw new Error(r.error.message);
  return (r.data ?? []) as T;
};
const criancasQuery = queryOptions({ queryKey: ["familia", "criancas"], queryFn: async () => ok(await supabase.rpc("familia_criancas")) });
const agendaQ = (p: string) => queryOptions({ queryKey: ["familia", p, "agenda"], queryFn: async () => ok(await supabase.rpc("familia_agenda", { _paciente: p })) });
const cobrancasQ = (p: string) =>
  queryOptions({ queryKey: ["familia", p, "cobrancas"], queryFn: async () => ok(await supabase.rpc("familia_cobrancas", { _paciente: p })) });
const relatoriosQ = (p: string) =>
  queryOptions({ queryKey: ["familia", p, "relatorios"], queryFn: async () => ok(await supabase.rpc("familia_relatorios", { _paciente: p })) });
const termosQ = (p: string) => queryOptions({ queryKey: ["familia", p, "termos"], queryFn: async () => ok(await supabase.rpc("familia_termos", { _paciente: p })) });

const ABAS = ["agenda", "pagamentos", "relatorios", "termos"] as const;

export const Route = createFileRoute("/familia/")({
  validateSearch: z.object({ crianca: z.string().optional(), aba: z.enum(ABAS).optional() }),
  loader: ({ context }) => context.queryClient.ensureQueryData(criancasQuery),
  component: PortalFamilia,
});

const Carregando = () => (
  <div className="flex justify-center py-10">
    <Loader2 className="size-6 animate-spin text-muted-foreground" />
  </div>
);

function PortalFamilia() {
  const { familiaEmail } = Route.useRouteContext();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const qc = useQueryClient();
  const { data: criancas } = useSuspenseQuery(criancasQuery);

  async function sair() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/familia", replace: true });
  }

  const direita = (
    <Button variant="ghost" size="sm" className="text-sidebar-foreground hover:bg-sidebar-accent" onClick={sair}>
      <LogOut /> Sair
    </Button>
  );

  if (criancas.length === 0)
    return (
      <MolduraFamilia direita={direita}>
        <div className="rounded-2xl border bg-card p-8 text-center">
          <h1 className="text-xl font-semibold">Nenhuma criança encontrada</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            O e-mail <span className="font-medium text-foreground">{familiaEmail}</span> não está na ficha de nenhuma criança, ou você entrou com senha
            de equipe. Saia e entre com o código enviado ao e-mail cadastrado na clínica.
          </p>
          <Button className="mt-5" onClick={sair}>
            Sair e entrar com o código
          </Button>
        </div>
      </MolduraFamilia>
    );

  const atual = criancas.find((c) => c.id === search.crianca) ?? criancas[0]!;
  const aba = search.aba ?? (atual.termos_pendentes > 0 ? "termos" : "agenda");

  return (
    <MolduraFamilia direita={direita}>
      {criancas.length > 1 && (
        <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
          {criancas.map((c) => (
            <Button
              key={c.id}
              size="sm"
              variant={c.id === atual.id ? "default" : "outline"}
              className="rounded-full"
              onClick={() => navigate({ search: { crianca: c.id } })}
            >
              {c.nome.split(" ")[0]}
            </Button>
          ))}
        </div>
      )}
      <div className="mb-5 rounded-2xl border bg-card p-5">
        <h1 className="text-xl font-semibold">{atual.nome}</h1>
        <p className="text-sm text-muted-foreground">
          {atual.data_nascimento ? `${idade(atual.data_nascimento)} · ` : ""}
          {atual.clinica_nome}
        </p>
        {atual.termos_pendentes > 0 && (
          <button
            onClick={() => navigate({ search: { crianca: atual.id, aba: "termos" } })}
            className="mt-3 flex w-full items-center gap-2 rounded-xl bg-warning/15 px-3 py-2 text-left text-sm font-medium text-warning-foreground"
          >
            <FileSignature className="size-4 shrink-0" /> {atual.termos_pendentes} termo(s) aguardando sua assinatura
          </button>
        )}
      </div>

      <Tabs value={aba} onValueChange={(v) => navigate({ search: { crianca: atual.id, aba: v as (typeof ABAS)[number] } })}>
        <TabsList className="mb-4 grid h-auto w-full grid-cols-4 bg-surface p-1">
          <TabsTrigger value="agenda" className="flex-col gap-0.5 py-2 text-xs sm:flex-row sm:text-sm">
            <CalendarDays className="size-4" /> Agenda
          </TabsTrigger>
          <TabsTrigger value="pagamentos" className="flex-col gap-0.5 py-2 text-xs sm:flex-row sm:text-sm">
            <Wallet className="size-4" /> Pagamentos
          </TabsTrigger>
          <TabsTrigger value="relatorios" className="flex-col gap-0.5 py-2 text-xs sm:flex-row sm:text-sm">
            <FileDown className="size-4" /> Relatórios
          </TabsTrigger>
          <TabsTrigger value="termos" className="flex-col gap-0.5 py-2 text-xs sm:flex-row sm:text-sm">
            <FileSignature className="size-4" /> Termos
          </TabsTrigger>
        </TabsList>
        <Suspense fallback={<Carregando />}>
          <TabsContent value="agenda">
            <AgendaFamilia pacienteId={atual.id} />
          </TabsContent>
          <TabsContent value="pagamentos">
            <PagamentosFamilia pacienteId={atual.id} paciente={atual.nome} />
          </TabsContent>
          <TabsContent value="relatorios">
            <RelatoriosFamilia pacienteId={atual.id} />
          </TabsContent>
          <TabsContent value="termos">
            <TermosFamilia pacienteId={atual.id} />
          </TabsContent>
        </Suspense>
      </Tabs>
    </MolduraFamilia>
  );
}

const Vazio = ({ texto }: { texto: string }) => <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">{texto}</div>;

function AgendaFamilia({ pacienteId }: { pacienteId: string }) {
  const { data } = useSuspenseQuery(agendaQ(pacienteId));
  const agora = new Date().toISOString();
  const proximas = data.filter((a) => a.inicio >= agora);
  const anteriores = data.filter((a) => a.inicio < agora).reverse().slice(0, 30);
  const Linha = ({ a }: { a: (typeof data)[number] }) => {
    const st = STATUS_AGENDA[a.status as StatusAgenda];
    return (
      <div className="flex items-center gap-3 rounded-xl border bg-card p-3">
        <div className="w-14 shrink-0 text-center">
          <div className="text-xs uppercase text-muted-foreground">{fmtData(a.inicio, "EEE")}</div>
          <div className="font-display text-lg font-semibold leading-tight">{fmtData(a.inicio, "dd/MM")}</div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{fmtHora(a.inicio)}</span>
            <span className={cn("rounded-full border px-2 py-0.5 text-xs", corEsp(a.cor))}>{a.especialidade}</span>
          </div>
          <div className="truncate text-sm text-muted-foreground">
            {a.profissional} · {a.sala}
          </div>
        </div>
        {st && <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-xs", st.className)}>{st.label}</span>}
      </div>
    );
  };
  if (!data.length) return <Vazio texto="Nenhuma sessão agendada." />;
  return (
    <div className="space-y-5">
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground">Próximas sessões</h2>
        {proximas.length ? proximas.map((a) => <Linha key={a.id} a={a} />) : <Vazio texto="Nenhuma sessão futura agendada." />}
      </section>
      {anteriores.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground">Sessões anteriores</h2>
          {anteriores.map((a) => (
            <Linha key={a.id} a={a} />
          ))}
        </section>
      )}
    </div>
  );
}

function PagamentosFamilia({ pacienteId, paciente }: { pacienteId: string; paciente: string }) {
  const { data } = useSuspenseQuery(cobrancasQ(pacienteId));
  if (!data.length) return <Vazio texto="Nenhuma cobrança por aqui." />;
  return (
    <div className="space-y-2">
      {data.map((c) => {
        const st = STATUS_COBRANCA[c.status as StatusCobranca];
        const pago = c.status === "pago";
        return (
          <div key={c.id} className="rounded-xl border bg-card p-4">
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <div className="font-medium">{c.descricao}</div>
                <div className="text-sm text-muted-foreground">
                  {pago && c.pago_em ? `Pago em ${fmtData(c.pago_em)}` : `Vence em ${fmtData(c.vencimento)}`}
                </div>
              </div>
              <div className="text-right">
                <div className="font-display text-lg font-semibold">{formatarMoeda(Number(c.valor_pago ?? c.valor))}</div>
                {st && <span className={cn("rounded-full px-2 py-0.5 text-xs", st.className)}>{st.label}</span>}
              </div>
            </div>
            {podePagar(c.status as StatusCobranca) && (
              <Button asChild className="mt-3 w-full">
                <Link to="/pagar/$token" params={{ token: c.token_publico }}>
                  <Wallet /> Pagar
                </Link>
              </Button>
            )}
            {pago && c.pago_em && (
              <Button
                variant="outline"
                className="mt-3 w-full"
                onClick={async () => {
                  const { baixarRecibo } = await import("@/lib/documentos-familia");
                  await baixarRecibo({
                    clinica: c.clinica_nome,
                    paciente,
                    descricao: c.descricao,
                    valor: Number(c.valor_pago ?? c.valor),
                    pago_em: c.pago_em!,
                    pagador_nome: c.pagador_nome,
                    pagador_cpf: c.pagador_cpf,
                    forma: rotuloForma(c.forma),
                    id: c.id,
                  });
                }}
              >
                <Receipt /> Baixar recibo
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
}

function RelatoriosFamilia({ pacienteId }: { pacienteId: string }) {
  const { data } = useSuspenseQuery(relatoriosQ(pacienteId));
  const baixar = useServerFn(baixarRelatorioFamilia);
  const [abrindo, setAbrindo] = useState<string | null>(null);
  if (!data.length) return <Vazio texto="A clínica ainda não liberou relatórios." />;
  return (
    <div className="space-y-2">
      {data.map((r) => (
        <div key={r.id} className="flex items-center gap-3 rounded-xl border bg-card p-4">
          <div className="min-w-0 flex-1">
            <div className="font-medium">{r.titulo}</div>
            <div className="text-sm text-muted-foreground">
              {fmtData(r.periodo_de)} a {fmtData(r.periodo_ate)}
              {r.finalidade && ` · ${r.finalidade}`}
            </div>
          </div>
          <Button
            variant="outline"
            disabled={abrindo === r.id}
            onClick={async () => {
              setAbrindo(r.id);
              try {
                const { url } = await baixar({ data: { id: r.id, pacienteId } });
                window.location.href = url;
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Não foi possível abrir.");
              } finally {
                setAbrindo(null);
              }
            }}
          >
            {abrindo === r.id ? <Loader2 className="animate-spin" /> : <FileDown />} Baixar
          </Button>
        </div>
      ))}
    </div>
  );
}

function TermosFamilia({ pacienteId }: { pacienteId: string }) {
  const { data } = useSuspenseQuery(termosQ(pacienteId));
  const comprovante = useServerFn(comprovanteTermoFamilia);
  const [assinar, setAssinar] = useState<TermoFamilia | null>(null);
  if (!data.length) return <Vazio texto="Nenhum termo para assinar." />;
  return (
    <div className="space-y-2">
      {data.map((t) => (
        <div key={t.id} className={cn("rounded-xl border bg-card p-4", t.status === "pendente" && "border-warning/60")}>
          <div className="font-medium">{t.titulo}</div>
          {t.status === "pendente" ? (
            <>
              <p className="text-sm text-muted-foreground">Enviado pela clínica em {fmtData(t.created_at)}</p>
              <Button className="mt-3 w-full" onClick={() => setAssinar(t)}>
                <FileSignature /> Ler e assinar
              </Button>
            </>
          ) : (
            <>
              <p className="flex items-center gap-1.5 text-sm text-success">
                <CheckCircle2 className="size-4" /> {ROTULO_DECISAO[t.decisao as Decisao]} · assinado por {t.assinante_nome} em{" "}
                {t.assinado_em && fmtData(t.assinado_em)}
              </p>
              <Button
                variant="outline"
                className="mt-3 w-full"
                onClick={async () => {
                  try {
                    const c = await comprovante({ data: { termoId: t.id, pacienteId } });
                    const { baixarComprovanteTermo } = await import("@/lib/documentos-familia");
                    await baixarComprovanteTermo(c);
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "Não foi possível baixar.");
                  }
                }}
              >
                <FileDown /> Baixar comprovante
              </Button>
            </>
          )}
        </div>
      ))}
      {assinar && <AssinarTermoDialog termo={assinar} pacienteId={pacienteId} onClose={() => setAssinar(null)} />}
    </div>
  );
}
