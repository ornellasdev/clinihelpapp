import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { addMinutes, addWeeks } from "date-fns";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { equipeQuery, especialidadesQuery, salasQuery } from "@/lib/queries";
import { erroAmigavel } from "@/lib/ui-helpers";
import { PacienteCombobox } from "@/components/PacienteCombobox";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export type NovoAgendamentoPadrao = { data: string; hora?: string; salaId?: string; pacienteId?: string; profissionalId?: string };

export function AgendamentoDialog({
  open,
  onOpenChange,
  padrao,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  padrao: NovoAgendamentoPadrao;
}) {
  const qc = useQueryClient();
  const { data: equipe = [] } = useQuery(equipeQuery);
  const { data: salas = [] } = useQuery(salasQuery);
  const { data: especialidades = [] } = useQuery(especialidadesQuery);

  const [pacienteId, setPacienteId] = useState("");
  const [profissionalId, setProfissionalId] = useState("");
  const [especialidadeId, setEspecialidadeId] = useState("");
  const [salaId, setSalaId] = useState("");
  const [data, setData] = useState(padrao.data);
  const [hora, setHora] = useState("08:00");
  const [duracao, setDuracao] = useState("50");
  const [semanas, setSemanas] = useState("1");
  const [obs, setObs] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPacienteId(padrao.pacienteId ?? "");
    setProfissionalId(padrao.profissionalId ?? "");
    setEspecialidadeId("");
    setSalaId(padrao.salaId ?? "");
    setData(padrao.data);
    setHora(padrao.hora ?? "08:00");
    setDuracao("50");
    setSemanas("1");
    setObs("");
  }, [open, padrao]);

  const profissionais = equipe.filter((m) => m.ativo && m.papeis.includes("profissional"));
  const prof = profissionais.find((p) => p.id === profissionalId);
  const espsDoProf = useMemo(
    () => especialidades.filter((e) => prof?.especialidades.includes(e.id)),
    [especialidades, prof],
  );

  useEffect(() => {
    if (espsDoProf.length === 1) setEspecialidadeId(espsDoProf[0]!.id);
    else if (!espsDoProf.some((e) => e.id === especialidadeId)) setEspecialidadeId("");
  }, [espsDoProf, especialidadeId]);

  async function salvar() {
    if (!pacienteId || !profissionalId || !especialidadeId || !salaId || !data || !hora) {
      toast.error("Preencha paciente, profissional, especialidade, sala, data e horário.");
      return;
    }
    setSalvando(true);
    const base = new Date(`${data}T${hora}:00`);
    const n = Math.max(1, Math.min(52, Number(semanas) || 1));
    let criados = 0;
    const falhas: string[] = [];
    for (let i = 0; i < n; i++) {
      const inicio = addWeeks(base, i);
      const fim = addMinutes(inicio, Number(duracao));
      const { error } = await supabase.from("agendamentos").insert({
        paciente_id: pacienteId,
        profissional_id: profissionalId,
        especialidade_id: especialidadeId,
        sala_id: salaId,
        inicio: inicio.toISOString(),
        fim: fim.toISOString(),
        observacoes: obs || null,
      });
      if (error) falhas.push(`${inicio.toLocaleDateString("pt-BR")}: ${erroAmigavel(error.message)}`);
      else criados++;
    }
    setSalvando(false);
    qc.invalidateQueries({ queryKey: ["agenda"] });
    if (criados) toast.success(criados === 1 ? "Atendimento agendado." : `${criados} atendimentos agendados.`);
    if (falhas.length) toast.error(falhas.slice(0, 4).join("\n"), { duration: 8000 });
    if (!falhas.length) onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo agendamento</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label>Paciente</Label>
            <PacienteCombobox value={pacienteId} onChange={setPacienteId} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>Profissional</Label>
              <Select value={profissionalId} onValueChange={setProfissionalId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {profissionais.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Especialidade</Label>
              <Select value={especialidadeId} onValueChange={setEspecialidadeId} disabled={!prof}>
                <SelectTrigger>
                  <SelectValue placeholder={prof && !espsDoProf.length ? "Sem especialidade" : "Selecione"} />
                </SelectTrigger>
                <SelectContent>
                  {espsDoProf.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Sala</Label>
            <Select value={salaId} onValueChange={setSalaId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a sala" />
              </SelectTrigger>
              <SelectContent>
                {salas
                  .filter((s) => s.ativa)
                  .map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.nome}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-3 grid gap-2 sm:col-span-1">
              <Label>Data</Label>
              <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Início</Label>
              <Input type="time" step={300} value={hora} onChange={(e) => setHora(e.target.value)} />
            </div>
            <div className="col-span-2 grid gap-2 sm:col-span-1">
              <Label>Duração</Label>
              <Select value={duracao} onValueChange={setDuracao}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[30, 40, 45, 50, 60, 90].map((m) => (
                    <SelectItem key={m} value={String(m)}>
                      {m} min
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Repetir semanalmente</Label>
            <Select value={semanas} onValueChange={setSemanas}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 4, 8, 12, 16, 24].map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n === 1 ? "Não repetir" : `${n} semanas`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Observações</Label>
            <Textarea rows={2} value={obs} onChange={(e) => setObs(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={salvar} disabled={salvando}>
            {salvando && <Loader2 className="animate-spin" />} Agendar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
