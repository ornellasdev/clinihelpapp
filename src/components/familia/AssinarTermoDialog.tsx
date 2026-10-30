import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, PenLine } from "lucide-react";
import { toast } from "sonner";
import { assinarTermo } from "@/lib/familia.functions";
import { PARENTESCOS, ROTULO_DECISAO, decisoesDoTipo, formatarCpf, validarAssinatura, type Decisao } from "@/lib/familia";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AssinaturaPad, type AssinaturaPadRef } from "./AssinaturaPad";
import { cn } from "@/lib/utils";

export type TermoFamilia = { id: string; tipo: string; titulo: string; texto: string; clinica_nome: string; paciente_nome: string };

export function AssinarTermoDialog({ termo, pacienteId, onClose }: { termo: TermoFamilia; pacienteId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const assinar = useServerFn(assinarTermo);
  const pad = useRef<AssinaturaPadRef>(null);
  const opcoes = decisoesDoTipo(termo.tipo);
  const [decisao, setDecisao] = useState<Decisao | "">(opcoes.length === 1 ? opcoes[0]! : "");
  const [nome, setNome] = useState("");
  const [cpf, setCpf] = useState("");
  const [parentesco, setParentesco] = useState("");
  const [li, setLi] = useState(false);
  const [enviando, setEnviando] = useState(false);

  async function confirmar() {
    if (!li) {
      toast.error("Confirme que leu o termo.");
      return;
    }
    if (pad.current?.vazio()) {
      toast.error("Faça sua assinatura no quadro.");
      return;
    }
    const dados = { nome, cpf, parentesco, decisao, tipo: termo.tipo, assinatura: pad.current?.imagem() ?? "" };
    const erro = validarAssinatura(dados);
    if (erro) {
      toast.error(erro);
      return;
    }
    setEnviando(true);
    try {
      await assinar({ data: { termoId: termo.id, pacienteId, nome, cpf, parentesco, decisao: decisao as Decisao, assinatura: dados.assinatura } });
      toast.success("Termo assinado. Obrigado!");
      qc.invalidateQueries({ queryKey: ["familia"] });
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível assinar.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[95dvh] overflow-y-auto p-4 sm:max-w-lg sm:p-6">
        <DialogHeader>
          <DialogTitle>{termo.titulo}</DialogTitle>
          <DialogDescription>
            {termo.clinica_nome} · {termo.paciente_nome}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[40dvh] overflow-y-auto whitespace-pre-wrap rounded-xl border bg-surface p-4 text-sm leading-relaxed">{termo.texto}</div>

        {opcoes.length > 1 && (
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Sua decisão">
            {opcoes.map((o) => (
              <button
                key={o}
                type="button"
                role="radio"
                aria-checked={decisao === o}
                onClick={() => setDecisao(o)}
                className={cn(
                  "min-h-12 rounded-xl border px-3 font-medium",
                  decisao === o ? (o === "nao_autorizo" ? "border-destructive bg-destructive text-destructive-foreground" : "border-primary bg-primary text-primary-foreground") : "bg-card",
                )}
              >
                {ROTULO_DECISAO[o]}
              </button>
            ))}
          </div>
        )}

        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="ass-nome">Seu nome completo</Label>
            <Input id="ass-nome" autoComplete="name" value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="ass-cpf">CPF</Label>
              <Input id="ass-cpf" inputMode="numeric" value={cpf} onChange={(e) => setCpf(formatarCpf(e.target.value))} placeholder="000.000.000-00" />
            </div>
            <div className="grid gap-1.5">
              <Label>Parentesco</Label>
              <Select value={parentesco} onValueChange={setParentesco}>
                <SelectTrigger aria-label="Parentesco">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {PARENTESCOS.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label className="flex items-center gap-1.5">
              <PenLine className="size-4" /> Assinatura
            </Label>
            <AssinaturaPad ref={pad} />
          </div>
          <label className="flex items-start gap-2 text-sm">
            <Checkbox checked={li} onCheckedChange={(c) => setLi(!!c)} className="mt-0.5" aria-label="Li o termo" />
            Li o termo acima e confirmo que sou responsável legal pela criança.
          </label>
        </div>

        <Button className="h-12 w-full" onClick={confirmar} disabled={enviando}>
          {enviando && <Loader2 className="animate-spin" />} Assinar termo
        </Button>
        <p className="text-center text-xs text-muted-foreground">Registramos data, hora, aparelho e uma cópia fiel do texto assinado.</p>
      </DialogContent>
    </Dialog>
  );
}
