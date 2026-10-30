import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Clock, Loader2, XCircle } from "lucide-react";
import { situacaoRecebimentos } from "@/lib/dev.functions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const SITUACAO: Record<string, { label: string; texto: string; icone: React.ReactNode }> = {
  APPROVED: { label: "Aprovada", texto: "A clínica já pode receber pagamentos.", icone: <CheckCircle2 className="size-5 text-success" /> },
  AWAITING_APPROVAL: { label: "Em análise", texto: "Documentos enviados; o Asaas está analisando.", icone: <Clock className="size-5 text-warning" /> },
  PENDING: { label: "Aguardando documentos", texto: "A clínica precisa concluir o cadastro no Asaas.", icone: <Clock className="size-5 text-warning" /> },
  REJECTED: { label: "Recusada", texto: "O Asaas recusou o cadastro da clínica.", icone: <XCircle className="size-5 text-destructive" /> },
};

type Clinica = { id: string; nome: string; pagamentos_ativos: boolean };

/** Desenvolvedor só consulta: quem conecta a conta Asaas é a própria clínica, em Financeiro › Cobranças. */
export function RecebimentosDialog({ clinica, onClose }: { clinica: Clinica | null; onClose: () => void }) {
  return (
    <Dialog open={!!clinica} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Recebimentos — {clinica?.nome}</DialogTitle>
          <DialogDescription>Cada clínica conecta a própria conta Asaas em Financeiro › Cobranças. O dinheiro vai direto para ela.</DialogDescription>
        </DialogHeader>
        {clinica &&
          (clinica.pagamentos_ativos ? (
            <Situacao clinicaId={clinica.id} />
          ) : (
            <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
              Esta clínica ainda não conectou a conta Asaas. O master ou o administrador faz isso em Financeiro › Cobranças.
            </p>
          ))}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Situacao({ clinicaId }: { clinicaId: string }) {
  const consultar = useServerFn(situacaoRecebimentos);
  const { data, isLoading } = useQuery({ queryKey: ["dev-recebimentos", clinicaId], queryFn: () => consultar({ data: { clinicaId } }) });
  if (isLoading) return <Loader2 className="mx-auto my-6 size-6 animate-spin text-muted-foreground" />;
  const s = data?.geral ? SITUACAO[data.geral] : null;
  return (
    <div className="space-y-4">
      <div className="rounded-xl border p-4">
        <div className="flex items-center gap-2 font-medium">
          {s?.icone} {s ? s.label : "Situação indisponível no momento"}
        </div>
        {s && <p className="mt-1 text-sm text-muted-foreground">{s.texto}</p>}
      </div>
      {data && (
        <dl className="grid grid-cols-2 gap-2 text-sm">
          <dt className="text-muted-foreground">Titular</dt>
          <dd>{data.titular_nome}</dd>
          <dt className="text-muted-foreground">Ambiente</dt>
          <dd>{data.ambiente === "sandbox" ? "Teste (sem dinheiro real)" : "Real"}</dd>
        </dl>
      )}
    </div>
  );
}
