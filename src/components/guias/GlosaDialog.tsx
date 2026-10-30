import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { conveniosQuery, guiasQuery, type Glosa } from "@/lib/queries";
import { MOTIVOS_GLOSA, STATUS_GLOSA, type StatusGlosa, exigeGuia } from "@/lib/guias";
import { erroAmigavel } from "@/lib/ui-helpers";
import { PacienteCombobox } from "@/components/PacienteCombobox";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export type GlosaPadrao = {
  paciente_id: string;
  convenio_id?: string | null;
  guia_id?: string | null;
  agendamento_id?: string | null;
  valor?: number | null;
  /** Ex.: "Sessão de 12/10/2026 · Ana" — só para mostrar ao usuário. */
  referencia?: string;
};

const SEM_GUIA = "nenhuma";
const hoje = () => format(new Date(), "yyyy-MM-dd");

export function GlosaDialog({
  open,
  onOpenChange,
  glosa,
  padrao,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  glosa: Glosa | null;
  padrao?: GlosaPadrao | null;
}) {
  const qc = useQueryClient();
  const { data: convenios = [] } = useQuery(conveniosQuery);
  const { data: guias = [] } = useQuery(guiasQuery);

  const [pacienteId, setPacienteId] = useState("");
  const [convenioId, setConvenioId] = useState("");
  const [guiaId, setGuiaId] = useState(SEM_GUIA);
  const [agendamentoId, setAgendamentoId] = useState<string | null>(null);
  const [valor, setValor] = useState("");
  const [motivo, setMotivo] = useState("token");
  const [detalhe, setDetalhe] = useState("");
  const [status, setStatus] = useState<StatusGlosa>("identificada");
  const [dataGlosa, setDataGlosa] = useState(hoje());
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPacienteId(glosa?.paciente_id ?? padrao?.paciente_id ?? "");
    setConvenioId(glosa?.convenio_id ?? padrao?.convenio_id ?? "");
    setGuiaId(glosa?.guia_id ?? padrao?.guia_id ?? SEM_GUIA);
    setAgendamentoId(glosa?.agendamento_id ?? padrao?.agendamento_id ?? null);
    setValor(glosa ? String(glosa.valor) : padrao?.valor ? String(padrao.valor) : "");
    setMotivo(glosa?.motivo ?? "token");
    setDetalhe(glosa?.motivo_detalhe ?? "");
    setStatus((glosa?.status as StatusGlosa) ?? "identificada");
    setDataGlosa(glosa?.data_glosa ?? hoje());
  }, [open, glosa, padrao]);

  const guiasPaciente = guias.filter((g) => g.paciente_id === pacienteId);
  const fixo = !!(glosa?.agendamento_id || padrao?.agendamento_id);

  function escolherGuia(id: string) {
    setGuiaId(id);
    const g = guias.find((x) => x.id === id);
    if (g) setConvenioId(g.convenio_id);
  }

  async function salvar() {
    const v = Number(valor.replace(",", "."));
    if (!pacienteId || !convenioId) return void toast.error("Escolha o paciente e o convênio.");
    if (!(v > 0)) return void toast.error("Informe o valor glosado.");
    setSalvando(true);
    const resolvido = status === "recuperada" || status === "perda";
    const dados = {
      paciente_id: pacienteId,
      convenio_id: convenioId,
      guia_id: guiaId === SEM_GUIA ? null : guiaId,
      agendamento_id: agendamentoId,
      valor: Math.round(v * 100) / 100,
      motivo,
      motivo_detalhe: detalhe.trim() || null,
      status,
      data_glosa: dataGlosa || hoje(),
      resolvido_em: resolvido ? (glosa?.resolvido_em ?? hoje()) : null,
    };
    const { error } = glosa ? await supabase.from("glosas").update(dados).eq("id", glosa.id) : await supabase.from("glosas").insert(dados);
    setSalvando(false);
    if (error) return void toast.error(erroAmigavel(error.message));
    toast.success(glosa ? "Glosa atualizada." : "Glosa registrada.");
    qc.invalidateQueries({ queryKey: ["glosas"] });
    onOpenChange(false);
  }

  const referencia = padrao?.referencia ?? (glosa?.agendamento?.inicio ? `Sessão de ${format(new Date(glosa.agendamento.inicio), "dd/MM/yyyy HH:mm")}` : null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{glosa ? "Editar glosa" : "Registrar glosa"}</DialogTitle>
          {referencia && <DialogDescription>{referencia}</DialogDescription>}
        </DialogHeader>
        <div className="grid gap-4">
          {!fixo && (
            <div className="grid gap-2">
              <Label>Paciente</Label>
              <PacienteCombobox
                value={pacienteId}
                onChange={(id) => {
                  setPacienteId(id);
                  setGuiaId(SEM_GUIA);
                }}
              />
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>Guia (opcional)</Label>
              <Select value={guiaId} onValueChange={escolherGuia}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SEM_GUIA}>Sem guia</SelectItem>
                  {guiasPaciente.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.codigo_guia} · {g.especialidade?.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Convênio</Label>
              <Select value={convenioId} onValueChange={setConvenioId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {convenios
                    .filter((c) => exigeGuia(c.tipo) || c.id === convenioId)
                    .map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nome}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>Valor glosado (R$)</Label>
              <Input inputMode="decimal" value={valor} placeholder="0,00" onChange={(e) => setValor(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Data da glosa</Label>
              <Input type="date" value={dataGlosa} onChange={(e) => setDataGlosa(e.target.value)} />
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Motivo</Label>
            <Select value={motivo} onValueChange={setMotivo}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MOTIVOS_GLOSA.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Textarea rows={2} maxLength={500} value={detalhe} placeholder="Detalhes (opcional)" onChange={(e) => setDetalhe(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>Status do recurso</Label>
            <div className="grid grid-cols-2 gap-1.5">
              {(Object.keys(STATUS_GLOSA) as StatusGlosa[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  aria-pressed={status === s}
                  onClick={() => setStatus(s)}
                  className={
                    status === s
                      ? "rounded-lg border border-primary bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
                      : "rounded-lg border bg-card px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary"
                  }
                >
                  {STATUS_GLOSA[s].label}
                </button>
              ))}
            </div>
          </div>
        </div>
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
