import { useState } from "react";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { format, startOfMonth, subMonths } from "date-fns";
import { FileDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";
import { evolucoesQuery, metasQuery, pacienteQuery, progressoMetasQuery } from "@/lib/queries";
import { useMe } from "@/hooks/use-me";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const FINALIDADES = ["Escola", "Médico", "Convênio", "Família", "Outro"];

export function RelatorioPdfDialog({
  pacienteId,
  especialidades,
}: {
  pacienteId: string;
  especialidades: Tables<"especialidades">[];
}) {
  const me = useMe();
  const qc = useQueryClient();
  const { data: evolucoes } = useSuspenseQuery(evolucoesQuery(pacienteId));
  const [aberto, setAberto] = useState(false);
  const hoje = new Date();
  const [de, setDe] = useState(format(startOfMonth(subMonths(hoje, 2)), "yyyy-MM-dd"));
  const [ate, setAte] = useState(format(hoje, "yyyy-MM-dd"));
  const [esps, setEsps] = useState<string[]>(() => especialidades.map((e) => e.id));
  const [finalidade, setFinalidade] = useState("Escola");
  const [incluirMetas, setIncluirMetas] = useState(true);
  const [incluirEvolucoes, setIncluirEvolucoes] = useState(true);
  const [gerando, setGerando] = useState(false);

  const qtd = evolucoes.filter((e) => e.data_atendimento >= de && e.data_atendimento <= ate && esps.includes(e.especialidade_id)).length;

  async function gerar() {
    if (!de || !ate || de > ate) { toast.error("Confira o período."); return; }
    if (!esps.length) { toast.error("Escolha ao menos uma especialidade."); return; }
    if (!incluirMetas && !incluirEvolucoes) { toast.error("Escolha o que incluir no relatório."); return; }
    setGerando(true);
    try {
      const [paciente, metas, progresso] = await Promise.all([
        qc.ensureQueryData(pacienteQuery(pacienteId)),
        qc.ensureQueryData(metasQuery(pacienteId)),
        qc.ensureQueryData(progressoMetasQuery(pacienteId)),
      ]);
      const { gerarRelatorioPaciente } = await import("@/lib/relatorio-paciente");
      await gerarRelatorioPaciente({
        clinica: me.clinica?.nome ?? "Clínica",
        finalidade,
        paciente,
        de,
        ate,
        especialidades: especialidades.filter((e) => esps.includes(e.id)),
        evolucoes,
        metas,
        progresso,
        incluirMetas,
        incluirEvolucoes,
      });
      toast.success("Relatório gerado.");
      setAberto(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível gerar o relatório.");
    } finally {
      setGerando(false);
    }
  }

  return (
    <>
      <Button variant="outline" onClick={() => setAberto(true)} className="w-full sm:ml-auto sm:w-auto">
        <FileDown /> Relatório PDF
      </Button>
      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Relatório do paciente</DialogTitle>
            <DialogDescription>Junta as evoluções e o progresso das metas do período num PDF.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>De</Label>
                <Input type="date" value={de} onChange={(e) => setDe(e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label>Até</Label>
                <Input type="date" value={ate} onChange={(e) => setAte(e.target.value)} />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>Para quem</Label>
              <Select value={finalidade} onValueChange={setFinalidade}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FINALIDADES.map((f) => (
                    <SelectItem key={f} value={f}>
                      {f}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Especialidades</Label>
              {especialidades.map((e) => (
                <label key={e.id} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={esps.includes(e.id)}
                    onCheckedChange={(c) => setEsps((cur) => (c ? [...cur, e.id] : cur.filter((x) => x !== e.id)))}
                  />
                  {e.nome}
                </label>
              ))}
            </div>
            <div className="grid gap-2">
              <Label>Incluir</Label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={incluirMetas} onCheckedChange={(c) => setIncluirMetas(!!c)} /> Metas e gráfico de progresso
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={incluirEvolucoes} onCheckedChange={(c) => setIncluirEvolucoes(!!c)} /> Texto das evoluções ({qtd})
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={gerar} disabled={gerando} className="w-full sm:w-auto">
              {gerando ? <Loader2 className="animate-spin" /> : <FileDown />} Gerar PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
