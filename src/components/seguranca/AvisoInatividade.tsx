import { Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/** Aviso no último minuto antes da saída automática por inatividade. */
export function AvisoInatividade({
  segundos,
  onContinuar,
  onSair,
}: {
  segundos: number | null;
  onContinuar: () => void;
  onSair: () => void;
}) {
  return (
    <Dialog open={segundos !== null} onOpenChange={(v) => !v && onContinuar()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="size-5 text-warning" /> Você ainda está aí?
          </DialogTitle>
          <DialogDescription>
            Por segurança dos dados dos pacientes, a sessão será encerrada em{" "}
            <span className="font-semibold text-foreground">{segundos ?? 0} s</span> por falta de uso.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onSair}>
            Sair agora
          </Button>
          <Button onClick={onContinuar} autoFocus>
            Continuar conectado
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
