import { useClinica } from "@/hooks/use-clinica";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Clock, DoorOpen, FilePenLine, Loader2, Paperclip, Play, RotateCcw, Trash2, User, UserCheck, UserRound } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { conveniosQuery, type AgendaItem } from "@/lib/queries";
import { useMe } from "@/hooks/use-me";
import { podeAgendar, podeEscreverEvolucao, podeVerGuias } from "@/lib/permissions";
import { exigeGuia } from "@/lib/guias";
import { STATUS_FALTAS, ehFalta, type StatusAgenda, type StatusFalta } from "@/lib/agenda-status";
import { STATUS_AGENDA, corEsp, erroAmigavel, fmtData, fmtHora } from "@/lib/ui-helpers";
import { abrirDocumento } from "./AnexoAtestado";
import { FaltaDialog } from "./FaltaDialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const FLUXO: StatusAgenda[] = ["agendado", "aguardando", "em_atendimento", "finalizado"];

export function AgendamentoDetalhe({ item, onClose }: { item: AgendaItem | null; onClose: () => void }) {
  const clinica = useClinica();
  const me = useMe();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [falta, setFalta] = useState<StatusFalta | null>(null);
  const [salvando, setSalvando] = useState<string | null>(null);
  const veGuias = podeVerGuias(me.papeis);
  const { data: convenios = [] } = useQuery({ ...conveniosQuery, enabled: veGuias && !!item });
  if (!item) return null;

  const podeEditar = podeAgendar(me.papeis) || item.profissional_id === me.id;
  const podeEvoluir = podeEscreverEvolucao(me.especialidades, item.especialidade_id);
  const meu = item.profissional_id === me.id;
  const atual = item.status as StatusAgenda;
  const tipoConvenio = convenios.find((c) => c.id === item.paciente?.convenio_id)?.tipo;
  const liberacaoPendente = veGuias && exigeGuia(tipoConvenio) && item.liberacao?.status !== "liberado";
  const anexos = item.documentos ?? [];

  function invalidar() {
    for (const k of [["agenda"], ["financeiro"], ["guias"], ["indicadores"], ["cobrancas"]]) qc.invalidateQueries({ queryKey: k });
  }

  async function mudarStatus(status: StatusAgenda) {
    if (ehFalta(status)) return setFalta(status);
    if (status === "aguardando" && liberacaoPendente && !confirm("A liberação desta sessão na operadora ainda não foi marcada. Marcar a chegada mesmo assim?")) return;
    if (status === "finalizado" && !confirm("A sessão é finalizada automaticamente quando o profissional salva a evolução. Finalizar agora, sem evolução?")) return;
    setSalvando(status);
    const { error } = await supabase.from("agendamentos").update({ status }).eq("id", item!.id);
    setSalvando(null);
    if (error) return void toast.error(erroAmigavel(error.message));
    toast.success(`Status: ${STATUS_AGENDA[status].label}`);
    invalidar();
    onClose();
  }

  /** Profissional inicia: status "Em atendimento" e abre o prontuário da sessão. */
  async function iniciar() {
    setSalvando("iniciar");
    if (atual === "agendado" || atual === "aguardando") {
      const { error } = await supabase.from("agendamentos").update({ status: "em_atendimento" }).eq("id", item!.id);
      if (error) {
        setSalvando(null);
        return void toast.error(erroAmigavel(error.message));
      }
      invalidar();
    }
    setSalvando(null);
    onClose();
    navigate({ to: "/$clinica/pacientes/$id", params: { clinica, id: item!.paciente_id }, search: { aba: "prontuario", agendamento: item!.id } });
  }

  async function excluir() {
    if (!confirm("Excluir este agendamento? Prefira marcar como cancelado para manter o histórico.")) return;
    const { error } = await supabase.from("agendamentos").delete().eq("id", item!.id);
    if (error) { toast.error(erroAmigavel(error.message)); return; }
    qc.invalidateQueries({ queryKey: ["agenda"] });
    onClose();
  }

  const podeChegar = podeAgendar(me.papeis) && atual === "agendado";
  const podeIniciar = meu && podeEvoluir && (atual === "agendado" || atual === "aguardando" || atual === "em_atendimento");

  return (
    <>
      <Dialog open={!!item && !falta} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="pr-6">{item.paciente?.nome}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-wrap gap-2">
            <span className={cn("rounded-full border px-2.5 py-0.5 text-xs font-medium", corEsp(item.especialidade?.cor))}>
              {item.especialidade?.nome}
            </span>
            <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", STATUS_AGENDA[atual].className)}>
              {STATUS_AGENDA[atual].label}
            </span>
            {item.reposicao_pendente && (
              <span className="inline-flex items-center gap-1 rounded-full bg-warning/25 px-2.5 py-0.5 text-xs font-medium text-warning-foreground">
                <RotateCcw className="size-3" /> Reposição pendente
              </span>
            )}
          </div>
          <dl className="grid gap-2.5 text-sm">
            <div className="flex items-center gap-2">
              <Clock className="size-4 text-muted-foreground" />
              {fmtData(item.inicio, "EEEE, dd/MM")} · {fmtHora(item.inicio)}–{fmtHora(item.fim)}
            </div>
            <div className="flex items-center gap-2">
              <UserRound className="size-4 text-muted-foreground" />
              {item.profissional?.nome}
            </div>
            <div className="flex items-center gap-2">
              <DoorOpen className="size-4 text-muted-foreground" />
              {item.sala?.nome}
            </div>
            {(item.chegada_em || item.atendimento_iniciado_em || item.finalizado_em) && (
              <div className="text-xs text-muted-foreground">
                {[
                  item.chegada_em && `Chegou ${fmtHora(item.chegada_em)}`,
                  item.atendimento_iniciado_em && `iniciado ${fmtHora(item.atendimento_iniciado_em)}`,
                  item.finalizado_em && `finalizado ${fmtHora(item.finalizado_em)}`,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </div>
            )}
            {item.observacoes && <p className="rounded-lg bg-muted p-3 text-muted-foreground">{item.observacoes}</p>}
            {ehFalta(atual) && (item.falta_motivo || atual === "falta_cobrada") && (
              <div className="rounded-lg border p-3 text-sm">
                {item.falta_motivo && <p>{item.falta_motivo}</p>}
                {atual === "falta_cobrada" && (
                  <p className="text-xs text-muted-foreground">{item.falta_repasse === false ? "Sem repasse ao profissional." : "Com repasse ao profissional pela hora reservada."}</p>
                )}
              </div>
            )}
            {anexos.length > 0 && (
              <ul className="grid gap-1">
                {anexos.map((d) => (
                  <li key={d.id}>
                    <button
                      type="button"
                      onClick={() => abrirDocumento(d.storage_path)}
                      className="flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left hover:bg-muted"
                    >
                      <Paperclip className="size-4 shrink-0 text-primary" /> <span className="truncate">{d.nome}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </dl>

          {(podeChegar || podeIniciar) && (
            <div className="grid gap-2">
              {podeChegar && (
                <Button onClick={() => mudarStatus("aguardando")} disabled={!!salvando}>
                  {salvando === "aguardando" ? <Loader2 className="animate-spin" /> : <UserCheck />} Chegou — aguardando atendimento
                </Button>
              )}
              {podeIniciar && (
                <Button onClick={iniciar} disabled={!!salvando} variant={podeChegar ? "secondary" : "default"}>
                  {salvando === "iniciar" ? <Loader2 className="animate-spin" /> : <Play />}
                  {atual === "em_atendimento" ? "Continuar evolução" : "Iniciar atendimento"}
                </Button>
              )}
            </div>
          )}

          {podeEditar && (
            <div className="grid gap-3">
              <div>
                <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Atendimento</div>
                <div className="flex flex-wrap gap-2">
                  {FLUXO.filter((s) => s !== atual).map((s) => (
                    <BotaoStatus key={s} s={s} onClick={() => mudarStatus(s)} carregando={salvando === s} disabled={!!salvando} />
                  ))}
                </div>
              </div>
              <div>
                <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Faltas</div>
                <div className="flex flex-wrap gap-2">
                  {STATUS_FALTAS.map((s) => (
                    <BotaoStatus
                      key={s}
                      s={s}
                      rotulo={s === atual ? (s === "falta_justificada" ? "Editar / anexar atestado" : "Editar falta") : undefined}
                      onClick={() => mudarStatus(s)}
                      disabled={!!salvando}
                    />
                  ))}
                  {atual !== "cancelado" && <BotaoStatus s="cancelado" onClick={() => mudarStatus("cancelado")} carregando={salvando === "cancelado"} disabled={!!salvando} />}
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2 border-t pt-4">
            <Button asChild variant="secondary" size="sm">
              <Link to="/$clinica/pacientes/$id" params={{ clinica, id: item.paciente_id }}>
                <User /> Ficha do paciente
              </Link>
            </Button>
            {podeEvoluir && !podeIniciar && (
              <Button asChild size="sm">
                <Link to="/$clinica/pacientes/$id" params={{ clinica, id: item.paciente_id }} search={{ aba: "prontuario", agendamento: item.id }}>
                  <FilePenLine /> Registrar evolução
                </Link>
              </Button>
            )}
            {podeAgendar(me.papeis) && (
              <Button variant="ghost" size="sm" className="ml-auto text-destructive" onClick={excluir}>
                <Trash2 /> Excluir
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
      {falta && <FaltaDialog item={item} tipo={falta} onClose={() => setFalta(null)} onSalvo={() => (setFalta(null), onClose())} />}
    </>
  );
}

function BotaoStatus({ s, rotulo, onClick, carregando, disabled }: { s: StatusAgenda; rotulo?: string | undefined; onClick: () => void; carregando?: boolean; disabled?: boolean }) {
  return (
    <Button size="sm" variant="outline" onClick={onClick} disabled={disabled} className="gap-1.5">
      {carregando ? <Loader2 className="animate-spin" /> : <span className={cn("size-2 rounded-full", STATUS_AGENDA[s].className)} aria-hidden />}
      {rotulo ?? STATUS_AGENDA[s].label}
    </Button>
  );
}
