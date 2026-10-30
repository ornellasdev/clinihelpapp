import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CheckCircle2, Clock, Loader2, XCircle } from "lucide-react";
import { ativarRecebimentos, situacaoRecebimentos } from "@/lib/dev.functions";
import { somenteDigitos } from "@/lib/cobrancas";
import { erroAmigavel } from "@/lib/ui-helpers";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const SITUACAO: Record<string, { label: string; texto: string; icone: React.ReactNode }> = {
  APPROVED: { label: "Aprovada", texto: "A clínica já pode receber pagamentos.", icone: <CheckCircle2 className="size-5 text-success" /> },
  AWAITING_APPROVAL: { label: "Em análise", texto: "Documentos enviados; o Asaas está analisando.", icone: <Clock className="size-5 text-warning" /> },
  PENDING: { label: "Aguardando documentos", texto: "O titular recebeu um e-mail do Asaas para enviar os documentos da empresa.", icone: <Clock className="size-5 text-warning" /> },
  REJECTED: { label: "Recusada", texto: "O Asaas recusou o cadastro. Confira o e-mail do titular.", icone: <XCircle className="size-5 text-destructive" /> },
};

type Clinica = { id: string; nome: string; pagamentos_ativos: boolean };

export function RecebimentosDialog({ clinica, onClose, onAtivado }: { clinica: Clinica | null; onClose: () => void; onAtivado: () => void }) {
  return (
    <Dialog open={!!clinica} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Recebimentos — {clinica?.nome}</DialogTitle>
          <DialogDescription>
            Conta própria da clínica para receber Pix, boleto e cartão dos responsáveis. O dinheiro vai direto para a clínica.
          </DialogDescription>
        </DialogHeader>
        {clinica && (clinica.pagamentos_ativos ? <Situacao clinicaId={clinica.id} onClose={onClose} /> : <Formulario clinica={clinica} onClose={onClose} onAtivado={onAtivado} />)}
      </DialogContent>
    </Dialog>
  );
}

function Situacao({ clinicaId, onClose }: { clinicaId: string; onClose: () => void }) {
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
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Fechar</Button>
      </DialogFooter>
    </div>
  );
}

function Formulario({ clinica, onClose, onAtivado }: { clinica: Clinica; onClose: () => void; onAtivado: () => void }) {
  const ativar = useServerFn(ativarRecebimentos);
  const [f, setF] = useState({
    nome: clinica.nome, email: "", doc: "", nascimento: "", tipoEmpresa: "LIMITED", celular: "", faturamento: "",
    cep: "", endereco: "", numero: "", complemento: "", bairro: "",
  });
  const [enviando, setEnviando] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF((s) => ({ ...s, [k]: e.target.value }));
  const doc = somenteDigitos(f.doc);
  const pj = doc.length === 14;

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (doc.length !== 11 && doc.length !== 14) return toast.error("Informe um CPF (11 dígitos) ou CNPJ (14 dígitos).");
    setEnviando(true);
    try {
      await ativar({
        data: {
          clinicaId: clinica.id,
          nome: f.nome,
          email: f.email,
          cpfCnpj: doc,
          nascimento: pj ? undefined : f.nascimento,
          tipoEmpresa: pj ? (f.tipoEmpresa as "LIMITED") : undefined,
          celular: somenteDigitos(f.celular),
          faturamento: Number(f.faturamento.replace(/\./g, "").replace(",", ".")),
          cep: somenteDigitos(f.cep),
          endereco: f.endereco,
          numero: f.numero,
          complemento: f.complemento || undefined,
          bairro: f.bairro,
        },
      });
      toast.success("Recebimentos ativados! O titular vai receber um e-mail do Asaas para enviar os documentos.");
      onAtivado();
      onClose();
    } catch (err) {
      toast.error(erroAmigavel((err as Error).message));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={salvar} className="min-w-0 space-y-4">
      <p className="rounded-xl bg-muted/50 p-3 text-xs text-muted-foreground">
        Use os dados da empresa (ou do profissional) dona da clínica. O titular recebe um e-mail do Asaas para enviar os documentos uma única vez.
      </p>
      <div className="space-y-2">
        <Label htmlFor="r-nome">Razão social ou nome do titular</Label>
        <Input id="r-nome" required value={f.nome} onChange={set("nome")} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="r-doc">CNPJ ou CPF</Label>
          <Input id="r-doc" inputMode="numeric" required value={f.doc} onChange={set("doc")} />
        </div>
        {pj ? (
          <div className="space-y-2">
            <Label>Tipo de empresa</Label>
            <Select value={f.tipoEmpresa} onValueChange={(v) => setF((s) => ({ ...s, tipoEmpresa: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="LIMITED">Limitada (LTDA)</SelectItem>
                <SelectItem value="INDIVIDUAL">Individual</SelectItem>
                <SelectItem value="MEI">MEI</SelectItem>
                <SelectItem value="ASSOCIATION">Associação</SelectItem>
              </SelectContent>
            </Select>
          </div>
        ) : (
          <div className="space-y-2">
            <Label htmlFor="r-nasc">Data de nascimento</Label>
            <Input id="r-nasc" type="date" required={doc.length === 11} value={f.nascimento} onChange={set("nascimento")} />
          </div>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="r-email">E-mail do titular</Label>
          <Input id="r-email" type="email" required value={f.email} onChange={set("email")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="r-cel">Celular com DDD</Label>
          <Input id="r-cel" inputMode="tel" required value={f.celular} onChange={set("celular")} />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="r-fat">Faturamento mensal aproximado (R$)</Label>
        <Input id="r-fat" inputMode="decimal" required value={f.faturamento} onChange={set("faturamento")} />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-2">
          <Label htmlFor="r-cep">CEP</Label>
          <Input id="r-cep" inputMode="numeric" required value={f.cep} onChange={set("cep")} />
        </div>
        <div className="col-span-2 space-y-2">
          <Label htmlFor="r-end">Endereço (rua)</Label>
          <Input id="r-end" required value={f.endereco} onChange={set("endereco")} />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-2">
          <Label htmlFor="r-num">Número</Label>
          <Input id="r-num" required value={f.numero} onChange={set("numero")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="r-comp">Complemento</Label>
          <Input id="r-comp" value={f.complemento} onChange={set("complemento")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="r-bairro">Bairro</Label>
          <Input id="r-bairro" required value={f.bairro} onChange={set("bairro")} />
        </div>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
        <Button type="submit" disabled={enviando}>
          {enviando && <Loader2 className="animate-spin" />} Ativar recebimentos
        </Button>
      </DialogFooter>
    </form>
  );
}
