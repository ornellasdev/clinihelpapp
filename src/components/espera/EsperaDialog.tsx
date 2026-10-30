import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { equipeQuery, especialidadesQuery, type ItemEspera } from "@/lib/queries";
import { DIAS_SEMANA, PERIODOS } from "@/lib/lista-espera";
import { erroAmigavel } from "@/lib/ui-helpers";
import { PacienteCombobox } from "@/components/PacienteCombobox";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const QUALQUER = "qualquer";

export function EsperaDialog({ open, onOpenChange, item }: { open: boolean; onOpenChange: (v: boolean) => void; item: ItemEspera | null }) {
  const qc = useQueryClient();
  const { data: especialidades = [] } = useQuery(especialidadesQuery);
  const { data: equipe = [] } = useQuery(equipeQuery);

  const [pacienteId, setPacienteId] = useState("");
  const [especialidadeId, setEspecialidadeId] = useState("");
  const [profissionalId, setProfissionalId] = useState(QUALQUER);
  const [dias, setDias] = useState<number[]>([]);
  const [periodos, setPeriodos] = useState<string[]>([]);
  const [horarioObs, setHorarioObs] = useState("");
  const [prioridade, setPrioridade] = useState("normal");
  const [obs, setObs] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPacienteId(item?.paciente_id ?? "");
    setEspecialidadeId(item?.especialidade_id ?? "");
    setProfissionalId(item?.profissional_id ?? QUALQUER);
    setDias(item?.dias_semana ?? []);
    setPeriodos(item?.periodos ?? []);
    setHorarioObs(item?.horario_obs ?? "");
    setPrioridade(item?.prioridade ?? "normal");
    setObs(item?.observacoes ?? "");
  }, [open, item]);

  const profissionais = equipe.filter((m) => m.ativo && m.papeis.includes("profissional") && (!especialidadeId || m.especialidades.includes(especialidadeId)));

  useEffect(() => {
    if (profissionalId !== QUALQUER && equipe.length && !profissionais.some((p) => p.id === profissionalId)) setProfissionalId(QUALQUER);
  }, [profissionalId, profissionais, equipe.length]);

  const alternar = <T,>(lista: T[], v: T) => (lista.includes(v) ? lista.filter((x) => x !== v) : [...lista, v]);

  async function salvar() {
    if (!pacienteId || !especialidadeId) {
      toast.error("Escolha o paciente e a especialidade.");
      return;
    }
    setSalvando(true);
    const dados = {
      paciente_id: pacienteId,
      especialidade_id: especialidadeId,
      profissional_id: profissionalId === QUALQUER ? null : profissionalId,
      dias_semana: [...dias].sort(),
      periodos: PERIODOS.map((p) => p.v).filter((p) => periodos.includes(p)),
      horario_obs: horarioObs.trim() || null,
      prioridade,
      observacoes: obs.trim() || null,
    };
    const { error } = item
      ? await supabase.from("lista_espera").update(dados).eq("id", item.id)
      : await supabase.from("lista_espera").insert(dados);
    setSalvando(false);
    if (error) {
      toast.error(erroAmigavel(error.message));
      return;
    }
    toast.success(item ? "Pedido atualizado." : "Paciente incluído na lista de espera.");
    qc.invalidateQueries({ queryKey: ["lista_espera"] });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{item ? "Editar pedido de vaga" : "Incluir na lista de espera"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label>Paciente</Label>
            <PacienteCombobox value={pacienteId} onChange={setPacienteId} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>Especialidade</Label>
              <Select value={especialidadeId} onValueChange={setEspecialidadeId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {especialidades.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Profissional preferido</Label>
              <Select value={profissionalId} onValueChange={setProfissionalId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={QUALQUER}>Qualquer profissional</SelectItem>
                  {profissionais.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Dias possíveis</Label>
            <div className="flex flex-wrap gap-1.5">
              {DIAS_SEMANA.map((d) => (
                <Chip key={d.v} ativo={dias.includes(d.v)} onClick={() => setDias((x) => alternar(x, d.v))}>
                  {d.l}
                </Chip>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">Sem nenhum marcado = qualquer dia.</p>
          </div>
          <div className="grid gap-2">
            <Label>Períodos possíveis</Label>
            <div className="flex flex-wrap gap-1.5">
              {PERIODOS.map((p) => (
                <Chip key={p.v} ativo={periodos.includes(p.v)} onClick={() => setPeriodos((x) => alternar(x, p.v))}>
                  {p.l}
                </Chip>
              ))}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
            <div className="grid gap-2">
              <Label>Horário preferido (opcional)</Label>
              <Input value={horarioObs} maxLength={200} placeholder="Ex.: depois das 15h, saída da escola" onChange={(e) => setHorarioObs(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Prioridade</Label>
              <Select value={prioridade} onValueChange={setPrioridade}>
                <SelectTrigger className="sm:w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="alta">Alta</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Observações</Label>
            <Textarea rows={2} maxLength={1000} value={obs} onChange={(e) => setObs(e.target.value)} />
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

function Chip({ ativo, onClick, children }: { ativo: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ativo}
      className={cn(
        "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
        ativo ? "border-primary bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-secondary",
      )}
    >
      {children}
    </button>
  );
}
