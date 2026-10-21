import { Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Clock, DoorOpen, FilePenLine, Trash2, User, UserRound } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { AgendaItem } from "@/lib/queries";
import { useMe } from "@/hooks/use-me";
import { podeAgendar, podeEscreverEvolucao } from "@/lib/permissions";
import { STATUS_AGENDA, corEsp, erroAmigavel, fmtData, fmtHora } from "@/lib/ui-helpers";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const STATUS_OPCOES = ["agendado", "confirmado", "realizado", "falta", "cancelado"] as const;

export function AgendamentoDetalhe({ item, onClose }: { item: AgendaItem | null; onClose: () => void }) {
  const me = useMe();
  const qc = useQueryClient();
  if (!item) return null;

  const podeEditar = podeAgendar(me.papeis) || item.profissional_id === me.id;
  const podeEvoluir = podeEscreverEvolucao(me.especialidades, item.especialidade_id);

  async function mudarStatus(status: (typeof STATUS_OPCOES)[number]) {
    const { error } = await supabase.from("agendamentos").update({ status }).eq("id", item!.id);
    if (error) { toast.error(erroAmigavel(error.message)); return; }
    toast.success(`Status: ${STATUS_AGENDA[status].label}`);
    qc.invalidateQueries({ queryKey: ["agenda"] });
    qc.invalidateQueries({ queryKey: ["financeiro"] });
    onClose();
  }

  async function excluir() {
    if (!confirm("Excluir este agendamento? Prefira marcar como cancelado para manter o histórico.")) return;
    const { error } = await supabase.from("agendamentos").delete().eq("id", item!.id);
    if (error) { toast.error(erroAmigavel(error.message)); return; }
    qc.invalidateQueries({ queryKey: ["agenda"] });
    onClose();
  }

  return (
    <Dialog open={!!item} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="pr-6">{item.paciente?.nome}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-wrap gap-2">
          <span className={cn("rounded-full border px-2.5 py-0.5 text-xs font-medium", corEsp(item.especialidade?.cor))}>
            {item.especialidade?.nome}
          </span>
          <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", STATUS_AGENDA[item.status].className)}>
            {STATUS_AGENDA[item.status].label}
          </span>
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
          {item.observacoes && <p className="rounded-lg bg-muted p-3 text-muted-foreground">{item.observacoes}</p>}
        </dl>

        {podeEditar && (
          <div>
            <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Alterar status</div>
            <div className="flex flex-wrap gap-2">
              {STATUS_OPCOES.filter((s) => s !== item.status).map((s) => (
                <Button key={s} size="sm" variant="outline" onClick={() => mudarStatus(s)}>
                  {STATUS_AGENDA[s].label}
                </Button>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2 border-t pt-4">
          <Button asChild variant="secondary" size="sm">
            <Link to="/pacientes/$id" params={{ id: item.paciente_id }}>
              <User /> Ficha do paciente
            </Link>
          </Button>
          {podeEvoluir && (
            <Button asChild size="sm">
              <Link to="/pacientes/$id" params={{ id: item.paciente_id }} search={{ aba: "prontuario", agendamento: item.id }}>
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
  );
}
