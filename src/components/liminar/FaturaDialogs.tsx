import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { FaturaLiminar } from "@/lib/queries";
import { DIAS_PAGAMENTO_LIMINAR, vencimentoNF } from "@/lib/liminar";
import { nomeMes } from "@/lib/lista-presenca";
import { formatarMoeda } from "@/lib/financeiro";
import { erroAmigavel } from "@/lib/ui-helpers";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const hoje = () => format(new Date(), "yyyy-MM-dd");
const br = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/");

/** Depois de qualquer mudança no fechamento, atualiza liminar, financeiro e indicadores (o pagamento marca as sessões). */
export function useInvalidarLiminar() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["liminar"] });
    qc.invalidateQueries({ queryKey: ["financeiro"] });
    qc.invalidateQueries({ queryKey: ["indicadores"] });
  };
}

function descricao(f: FaturaLiminar) {
  return `${f.paciente?.nome ?? ""} · ${nomeMes(f.competencia.slice(0, 7))} · ${f.quantidade_sessoes} ${f.quantidade_sessoes === 1 ? "sessão" : "sessões"} · ${formatarMoeda(f.valor)}`;
}

export function NfDialog({ fatura, onOpenChange }: { fatura: FaturaLiminar | null; onOpenChange: (v: boolean) => void }) {
  const invalidar = useInvalidarLiminar();
  const [numero, setNumero] = useState("");
  const [emissao, setEmissao] = useState(hoje());
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!fatura) return;
    setNumero(fatura.nf_numero ?? "");
    setEmissao(fatura.nf_emissao ?? hoje());
  }, [fatura]);

  async function salvar() {
    if (!fatura) return;
    if (!numero.trim()) return void toast.error("Informe o número da nota fiscal.");
    if (!emissao) return void toast.error("Informe a data de emissão.");
    setSalvando(true);
    const { error } = await supabase
      .from("faturas_liminar")
      .update({ nf_numero: numero.trim(), nf_emissao: emissao, status: fatura.status === "paga" ? "paga" : "nf_emitida" })
      .eq("id", fatura.id);
    setSalvando(false);
    if (error) return void toast.error(erroAmigavel(error.message));
    toast.success(`NF ${numero.trim()} registrada · vence em ${br(vencimentoNF(emissao))}.`);
    invalidar();
    onOpenChange(false);
  }

  return (
    <Dialog open={!!fatura} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nota fiscal</DialogTitle>
          {fatura && <DialogDescription>{descricao(fatura)}</DialogDescription>}
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="nf-numero">Número da NF</Label>
            <Input id="nf-numero" value={numero} onChange={(e) => setNumero(e.target.value)} maxLength={60} placeholder="Ex.: 1234" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="nf-emissao">Data de emissão</Label>
            <Input id="nf-emissao" type="date" value={emissao} onChange={(e) => setEmissao(e.target.value)} />
          </div>
        </div>
        {emissao && (
          <p className="rounded-xl bg-surface p-3 text-sm">
            Vencimento: <strong>{br(vencimentoNF(emissao))}</strong>{" "}
            <span className="text-muted-foreground">({DIAS_PAGAMENTO_LIMINAR} dias após a emissão)</span>
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={salvar} disabled={salvando}>
            {salvando && <Loader2 className="animate-spin" />} Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function PagamentoDialog({ fatura, onOpenChange }: { fatura: FaturaLiminar | null; onOpenChange: (v: boolean) => void }) {
  const invalidar = useInvalidarLiminar();
  const [data, setData] = useState(hoje());
  const [valor, setValor] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!fatura) return;
    setData(hoje());
    setValor(String(fatura.valor));
  }, [fatura]);

  async function salvar() {
    if (!fatura) return;
    const v = Number(valor.replace(",", "."));
    if (!data) return void toast.error("Informe a data do pagamento.");
    if (!(v >= 0)) return void toast.error("Informe o valor recebido.");
    setSalvando(true);
    const { error } = await supabase
      .from("faturas_liminar")
      .update({ status: "paga", pago_em: data, valor_pago: Math.round(v * 100) / 100 })
      .eq("id", fatura.id);
    setSalvando(false);
    if (error) return void toast.error(erroAmigavel(error.message));
    toast.success("Pagamento registrado. As sessões do mês foram marcadas como pagas.");
    invalidar();
    onOpenChange(false);
  }

  return (
    <Dialog open={!!fatura} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar pagamento</DialogTitle>
          {fatura && (
            <DialogDescription>
              {descricao(fatura)}
              {fatura.nf_numero && ` · NF ${fatura.nf_numero}`}
            </DialogDescription>
          )}
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="pg-data">Data do pagamento</Label>
            <Input id="pg-data" type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="pg-valor">Valor recebido (R$)</Label>
            <Input id="pg-valor" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={salvar} disabled={salvando}>
            {salvando && <Loader2 className="animate-spin" />} Confirmar pagamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
