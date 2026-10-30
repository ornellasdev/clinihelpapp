import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { format } from "date-fns";
import { Plus } from "lucide-react";
import { z } from "zod";
import { agendaQuery, conveniosQuery, especialidadesQuery, faturamentoGuiasQuery, glosasQuery, guiasQuery, guiasUsoQuery, meQuery, type Glosa, type Guia } from "@/lib/queries";
import { useMe } from "@/hooks/use-me";
import { podeGerirGlosas, podeVerGuias } from "@/lib/permissions";
import { PageHeader } from "@/components/PageHeader";
import { GuiaDialog } from "@/components/guias/GuiaDialog";
import { GlosaDialog, type GlosaPadrao } from "@/components/guias/GlosaDialog";
import { LiberacoesDia, intervaloDia } from "@/components/guias/LiberacoesDia";
import { GuiasLista } from "@/components/guias/GuiasLista";
import { FaturamentoLote, intervaloMes } from "@/components/guias/FaturamentoLote";
import { GlosasLista } from "@/components/guias/GlosasLista";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const ABAS = ["dia", "guias", "faturamento", "glosas"] as const;
const hoje = () => format(new Date(), "yyyy-MM-dd");
const mesAtual = () => format(new Date(), "yyyy-MM");

export const Route = createFileRoute("/_authenticated/$clinica/guias")({
  validateSearch: z.object({
    aba: z.enum(ABAS).optional(),
    data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    mes: z.string().regex(/^\d{4}-\d{2}$/).optional(),
    convenio: z.string().optional(),
  }),
  beforeLoad: async ({ context, params }) => {
    const me = await context.queryClient.ensureQueryData(meQuery);
    if (!podeVerGuias(me.papeis)) throw redirect({ to: "/$clinica/painel", params });
  },
  loaderDeps: ({ search }) => ({ aba: search.aba ?? "dia", data: search.data ?? hoje(), mes: search.mes ?? mesAtual() }),
  loader: async ({ context, deps }) => {
    const qc = context.queryClient;
    const me = await qc.ensureQueryData(meQuery);
    const base = [qc.ensureQueryData(guiasQuery), qc.ensureQueryData(guiasUsoQuery), qc.ensureQueryData(conveniosQuery), qc.ensureQueryData(especialidadesQuery)];
    if (deps.aba === "dia") {
      const [a, b] = intervaloDia(deps.data);
      base.push(qc.ensureQueryData(agendaQuery(a, b)));
    } else if (deps.aba === "faturamento") {
      const [a, b] = intervaloMes(deps.mes);
      base.push(qc.ensureQueryData(faturamentoGuiasQuery(a, b)));
    } else if (deps.aba === "glosas" && podeGerirGlosas(me.papeis)) {
      base.push(qc.ensureQueryData(glosasQuery));
    }
    await Promise.all(base);
  },
  head: () => ({
    meta: [
      { title: "Guias de convênio — CliniHelp" },
      { name: "description", content: "Liberações do dia, guias autorizadas, faturamento por convênio e controle de glosas." },
    ],
  }),
  component: GuiasPage,
});

function GuiasPage() {
  const me = useMe();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const veGlosas = podeGerirGlosas(me.papeis);
  const aba = search.aba === "glosas" && !veGlosas ? "dia" : (search.aba ?? "dia");

  const [guiaAberta, setGuiaAberta] = useState<{ guia: Guia | null } | null>(null);
  const [glosaAberta, setGlosaAberta] = useState<{ glosa: Glosa | null; padrao?: GlosaPadrao | null } | null>(null);

  const glosarGuia = (g: Guia) =>
    setGlosaAberta({ glosa: null, padrao: { paciente_id: g.paciente_id, convenio_id: g.convenio_id, guia_id: g.id, referencia: `Guia ${g.codigo_guia} · ${g.paciente?.nome ?? ""}` } });

  return (
    <div>
      <PageHeader
        titulo="Guias de convênio"
        descricao="Controle interno de autorizações, liberações do dia, faturamento e glosas"
        acoes={
          <>
            {veGlosas && aba === "glosas" && (
              <Button variant="outline" onClick={() => setGlosaAberta({ glosa: null })}>
                <Plus /> Registrar glosa
              </Button>
            )}
            <Button onClick={() => setGuiaAberta({ guia: null })}>
              <Plus /> Nova guia
            </Button>
          </>
        }
      />

      <Tabs value={aba} onValueChange={(v) => navigate({ search: (s) => ({ ...s, aba: v as (typeof ABAS)[number] }) })}>
        <TabsList className="mb-5 h-auto w-full justify-start overflow-x-auto bg-surface p-1 sm:w-auto">
          <TabsTrigger value="dia" className="px-4 py-2">
            Liberações do dia
          </TabsTrigger>
          <TabsTrigger value="guias" className="px-4 py-2">
            Guias
          </TabsTrigger>
          <TabsTrigger value="faturamento" className="px-4 py-2">
            Faturamento
          </TabsTrigger>
          {veGlosas && (
            <TabsTrigger value="glosas" className="px-4 py-2">
              Glosas
            </TabsTrigger>
          )}
        </TabsList>
        <TabsContent value="dia">
          {aba === "dia" && (
            <LiberacoesDia
              data={search.data ?? hoje()}
              onData={(d) => navigate({ search: (s) => ({ ...s, data: d }) })}
              onAbrirGuia={(g) => setGuiaAberta({ guia: g })}
            />
          )}
        </TabsContent>
        <TabsContent value="guias">{aba === "guias" && <GuiasLista onEditar={(g) => setGuiaAberta({ guia: g })} onGlosar={glosarGuia} />}</TabsContent>
        <TabsContent value="faturamento">
          {aba === "faturamento" && (
            <FaturamentoLote
              mes={search.mes ?? mesAtual()}
              convenio={search.convenio}
              onFiltro={(f) => navigate({ search: (s) => ({ ...s, ...f }) })}
              onGlosar={(p) => setGlosaAberta({ glosa: null, padrao: p })}
            />
          )}
        </TabsContent>
        {veGlosas && <TabsContent value="glosas">{aba === "glosas" && <GlosasLista onEditar={(g) => setGlosaAberta({ glosa: g })} />}</TabsContent>}
      </Tabs>

      <GuiaDialog open={!!guiaAberta} onOpenChange={(v) => !v && setGuiaAberta(null)} guia={guiaAberta?.guia ?? null} />
      {veGlosas && (
        <GlosaDialog open={!!glosaAberta} onOpenChange={(v) => !v && setGlosaAberta(null)} glosa={glosaAberta?.glosa ?? null} padrao={glosaAberta?.padrao ?? null} />
      )}
    </div>
  );
}
