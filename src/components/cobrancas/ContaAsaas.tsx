import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { KeyRound, Link2, Loader2, Unplug } from "lucide-react";
import { conectarAsaas, desconectarAsaas, minhaContaRecebimento } from "@/lib/recebimentos.functions";
import { erroAmigavel } from "@/lib/ui-helpers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

const invalidar = (qc: ReturnType<typeof useQueryClient>, clinicaId: string) => {
  qc.invalidateQueries({ queryKey: ["clinica", clinicaId, "recebimentos"] });
  qc.invalidateQueries({ queryKey: ["conta-asaas", clinicaId] });
};

/** Formulário para a clínica colar a chave de API da própria conta Asaas. */
export function ConectarAsaas({ clinicaId, onCancelar }: { clinicaId: string; onCancelar?: () => void }) {
  const conectar = useServerFn(conectarAsaas);
  const qc = useQueryClient();
  const [chave, setChave] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    try {
      const r = await conectar({ data: { apiKey: chave.trim() } });
      toast.success(`Conta Asaas conectada${r.titular ? `: ${r.titular}` : ""}${r.ambiente === "sandbox" ? " (teste)" : ""}`);
      setChave("");
      invalidar(qc, clinicaId);
      onCancelar?.();
    } catch (err) {
      const msg = (err as Error).message;
      toast.error(msg.includes("inválida") || msg.includes("Invalid") ? "Chave do Asaas inválida. Confira se copiou a chave inteira." : erroAmigavel(msg));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={salvar} className="space-y-4 rounded-2xl border bg-card p-5 text-left">
      <div className="flex items-center gap-2 font-semibold">
        <KeyRound className="size-5 text-primary" /> Conectar a conta Asaas da clínica
      </div>
      <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
        <li>Entre na conta Asaas da clínica (crie uma em asaas.com, se ainda não tiver).</li>
        <li>Vá em <span className="font-medium text-foreground">Integrações → Chave de API</span> e gere uma chave.</li>
        <li>Cole a chave abaixo. Ela fica guardada com criptografia e ninguém da equipe consegue vê-la depois.</li>
      </ol>
      <div className="space-y-2">
        <Label htmlFor="asaas-chave">Chave de API do Asaas</Label>
        <Input
          id="asaas-chave"
          type="password"
          autoComplete="off"
          required
          placeholder="$aact_prod_..."
          value={chave}
          onChange={(e) => setChave(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">Chaves que começam com $aact_hmlg_ são de teste (sandbox), sem dinheiro de verdade.</p>
      </div>
      <div className="flex justify-end gap-2">
        {onCancelar && (
          <Button type="button" variant="outline" onClick={onCancelar}>
            Cancelar
          </Button>
        )}
        <Button type="submit" disabled={enviando || !chave.trim()}>
          {enviando ? <Loader2 className="animate-spin" /> : <Link2 />} Conectar
        </Button>
      </div>
    </form>
  );
}

/** Faixa com a conta conectada; gestão pode trocar a chave ou desconectar. */
export function ContaAsaasConectada({ clinicaId, gestor }: { clinicaId: string; gestor: boolean }) {
  const consultar = useServerFn(minhaContaRecebimento);
  const desconectar = useServerFn(desconectarAsaas);
  const qc = useQueryClient();
  const { data: conta } = useQuery({ queryKey: ["conta-asaas", clinicaId], queryFn: () => consultar() });
  const [trocando, setTrocando] = useState(false);
  const [confirmar, setConfirmar] = useState(false);

  async function sair() {
    setConfirmar(false);
    try {
      await desconectar();
      toast.success("Conta Asaas desconectada");
      invalidar(qc, clinicaId);
    } catch (err) {
      toast.error(erroAmigavel((err as Error).message));
    }
  }

  if (trocando) return <div className="mb-5"><ConectarAsaas clinicaId={clinicaId} onCancelar={() => setTrocando(false)} /></div>;

  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card px-4 py-3 text-sm">
      <div className="min-w-0">
        <span className="text-muted-foreground">Recebendo pela conta Asaas: </span>
        <span className="font-medium">{conta?.titular ?? "—"}</span>
        {conta?.documento && <span className="text-muted-foreground"> · {conta.documento}</span>}
        {conta?.ambiente === "sandbox" && (
          <span className="ml-2 rounded-full bg-warning/25 px-2 py-0.5 text-xs font-medium text-warning-foreground">Teste</span>
        )}
      </div>
      {gestor && (
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setTrocando(true)}>
            <KeyRound /> Trocar chave
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setConfirmar(true)}>
            <Unplug /> Desconectar
          </Button>
        </div>
      )}
      <AlertDialog open={confirmar} onOpenChange={setConfirmar}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desconectar a conta Asaas?</AlertDialogTitle>
            <AlertDialogDescription>A clínica deixa de gerar cobranças até conectar uma conta de novo. As cobranças já pagas continuam no histórico.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={sair}>Desconectar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
