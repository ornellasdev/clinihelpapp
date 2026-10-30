import { useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { MOTIVOS_ADENDO } from "@/services/prontuario";
import { useRegistrarAdendo } from "@/hooks/use-prontuario";
import { mensagemDeErro } from "@/services/resultado";
import { fmtData } from "@/lib/ui-helpers";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type EvolucaoAlvo = { id: string; paciente_id: string; especialidade_id: string; data_atendimento: string };

/** Errata/adendo: acrescenta à evolução original, que continua intacta. Depois de salvo não muda nem some. */
export function AdendoDialog({ evolucao, onClose }: { evolucao: EvolucaoAlvo | null; onClose: () => void }) {
  const registrar = useRegistrarAdendo(evolucao?.paciente_id ?? "");
  const [motivo, setMotivo] = useState<string>(MOTIVOS_ADENDO[0]);
  const [texto, setTexto] = useState("");

  async function salvar() {
    if (!evolucao) return;
    try {
      await registrar.mutateAsync({
        evolucaoId: evolucao.id,
        pacienteId: evolucao.paciente_id,
        especialidadeId: evolucao.especialidade_id,
        motivo,
        conteudo: texto,
      });
      toast.success("Adendo registrado.");
      setTexto("");
      onClose();
    } catch (e) {
      toast.error(mensagemDeErro(e));
    }
  }

  return (
    <Dialog open={!!evolucao} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Adendo à evolução de {evolucao ? fmtData(evolucao.data_atendimento, "dd/MM/yyyy") : ""}</DialogTitle>
          <DialogDescription>
            A evolução original não é alterada. O adendo fica abaixo dela com seu nome, registro, data e hora.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label>Motivo</Label>
            <Select value={motivo} onValueChange={setMotivo}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MOTIVOS_ADENDO.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>Texto do adendo</Label>
            <Textarea
              className="min-h-36 text-[15px] leading-relaxed"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Ex.: Onde se lê 45 minutos, leia-se 30 minutos de sessão."
            />
          </div>
          <p className="flex items-start gap-2 rounded-lg bg-muted p-3 text-xs text-muted-foreground">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
            Depois de salvo, o adendo também não pode ser editado nem apagado. Para corrigir, registre outro adendo.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={salvar} disabled={registrar.isPending || !texto.trim()}>
            {registrar.isPending && <Loader2 className="animate-spin" />} Registrar adendo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
