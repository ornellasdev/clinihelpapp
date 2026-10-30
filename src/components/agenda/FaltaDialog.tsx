import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { FileText, Loader2, Paperclip, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { AgendaItem } from "@/lib/queries";
import { useMe } from "@/hooks/use-me";
import type { StatusFalta } from "@/lib/agenda-status";
import { STATUS_AGENDA, fmtData, fmtHora } from "@/lib/ui-helpers";
import { abrirDocumento } from "./AnexoAtestado";
import { REGRA_ATESTADO, problemaNoArquivo } from "@/lib/validacao";
import { BUCKETS, caminhoArquivo, desfazerEnvio, enviarArquivo } from "@/services/arquivos";
import { mensagemDeErro } from "@/services/resultado";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

const LIMITE_MB = REGRA_ATESTADO.maxMB;

const EXPLICACAO: Record<StatusFalta, string> = {
  falta_justificada: "Não gera cobrança para a família/convênio, não desconta a guia e não gera repasse.",
  falta_terapeuta: "Não gera cobrança, não desconta a guia e não gera repasse para o terapeuta.",
  falta_cobrada: "Falta não justificada: é cobrada e entra no faturamento da sessão. A guia do convênio não é descontada.",
};

export function FaltaDialog({
  item,
  tipo,
  onClose,
  onSalvo,
}: {
  item: AgendaItem;
  tipo: StatusFalta;
  onClose: () => void;
  onSalvo: () => void;
}) {
  const me = useMe();
  const qc = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const jaEra = item.status === tipo;
  const [motivo, setMotivo] = useState(jaEra ? (item.falta_motivo ?? "") : "");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [repasse, setRepasse] = useState(jaEra ? (item.falta_repasse ?? true) : true);
  const [reposicao, setReposicao] = useState(jaEra ? item.reposicao_pendente : true);
  const [salvando, setSalvando] = useState(false);
  const anexos = item.documentos ?? [];

  function escolher(f: File | undefined) {
    if (!f) return;
    const problema = problemaNoArquivo(f, REGRA_ATESTADO);
    if (problema) {
      toast.error(problema);
      return;
    }
    setArquivo(f);
  }

  async function salvar() {
    setSalvando(true);
    try {
      if (arquivo) {
        const path = caminhoArquivo(me.clinica?.id, item.paciente_id, arquivo.name, "atestado-");
        await enviarArquivo(BUCKETS.documentos, path, arquivo, REGRA_ATESTADO);
        const { error } = await supabase.from("paciente_documentos").insert({
          paciente_id: item.paciente_id,
          agendamento_id: item.id,
          nome: arquivo.name,
          categoria: "Atestado",
          storage_path: path,
          tamanho: arquivo.size,
          mime_type: arquivo.type,
          enviado_por: me.id,
        });
        if (error) {
          await desfazerEnvio(BUCKETS.documentos, path);
          throw new Error(error.message);
        }
      }
      const { error } = await supabase
        .from("agendamentos")
        .update({
          status: tipo,
          falta_motivo: motivo.trim() || null,
          falta_repasse: tipo === "falta_cobrada" ? repasse : null,
          reposicao_pendente: tipo === "falta_terapeuta" ? reposicao : false,
        })
        .eq("id", item.id);
      if (error) throw new Error(error.message);
      toast.success(`${STATUS_AGENDA[tipo].label} registrada.`);
      for (const k of [["agenda"], ["financeiro"], ["guias"], ["documentos", item.paciente_id], ["indicadores"], ["cobrancas"]]) {
        qc.invalidateQueries({ queryKey: k });
      }
      onSalvo();
    } catch (e) {
      toast.error(mensagemDeErro(e));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && !salvando && onClose()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{STATUS_AGENDA[tipo].label}</DialogTitle>
          <DialogDescription>
            {item.paciente?.nome} · {fmtData(item.inicio, "dd/MM")} {fmtHora(item.inicio)} · {item.especialidade?.nome}
          </DialogDescription>
        </DialogHeader>

        <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">{EXPLICACAO[tipo]}</p>

        <div className="grid gap-1.5">
          <Label htmlFor="falta-motivo">{tipo === "falta_terapeuta" ? "Motivo da ausência" : "Observação / motivo"}</Label>
          <Textarea
            id="falta-motivo"
            value={motivo}
            maxLength={500}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder={tipo === "falta_justificada" ? "Ex.: atestado médico, febre, consulta..." : "Opcional"}
          />
        </div>

        {tipo === "falta_justificada" && (
          <div className="grid gap-2">
            <Label>Atestado ou comprovante (opcional)</Label>
            {anexos.length > 0 && (
              <ul className="grid gap-1">
                {anexos.map((d) => (
                  <li key={d.id}>
                    <button
                      type="button"
                      onClick={() => abrirDocumento(d.storage_path)}
                      className="flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm hover:bg-muted"
                    >
                      <Paperclip className="size-4 text-primary" /> <span className="truncate">{d.nome}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {arquivo ? (
              <div className="flex items-center gap-2 rounded-lg border bg-surface px-3 py-2 text-sm">
                <FileText className="size-4 shrink-0 text-primary" />
                <span className="flex-1 truncate">{arquivo.name}</span>
                <Button size="icon" variant="ghost" className="size-7" onClick={() => setArquivo(null)} aria-label="Remover arquivo">
                  <X />
                </Button>
              </div>
            ) : (
              <Button type="button" variant="outline" onClick={() => input.current?.click()}>
                <Paperclip /> {anexos.length ? "Anexar outro arquivo" : "Anexar atestado"}
              </Button>
            )}
            <input
              ref={input}
              type="file"
              hidden
              accept="application/pdf,image/jpeg,image/png"
              onChange={(e) => {
                escolher(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            <p className="text-xs text-muted-foreground">PDF, JPG ou PNG até {LIMITE_MB} MB. Fica salvo na sessão e nos documentos do paciente.</p>
          </div>
        )}

        {tipo === "falta_terapeuta" && (
          <label className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm">
            <span>
              <span className="font-medium">Precisa de reposição</span>
              <span className="block text-xs text-muted-foreground">Sinaliza que a sessão deve ser remarcada.</span>
            </span>
            <Switch checked={reposicao} onCheckedChange={setReposicao} />
          </label>
        )}

        {tipo === "falta_cobrada" && (
          <label className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm">
            <span>
              <span className="font-medium">Repasse ao profissional</span>
              <span className="block text-xs text-muted-foreground">Pagar o profissional pela hora reservada, mesmo sem atendimento.</span>
            </span>
            <Switch checked={repasse} onCheckedChange={setRepasse} />
          </label>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={salvando}>
            Voltar
          </Button>
          <Button onClick={salvar} disabled={salvando}>
            {salvando && <Loader2 className="animate-spin" />} {jaEra ? "Salvar" : "Registrar falta"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
