import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, ClipboardList, Loader2, MessageCircle, Receipt, Wallet } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import { avaliacaoInicialQuery } from "@/lib/queries";
import { useMe } from "@/hooks/use-me";
import { useClinica } from "@/hooks/use-clinica";
import { podeGerirFinanceiro, podeVerDadosClinicos } from "@/lib/permissions";
import {
  ETAPAS_AVALIACAO,
  STATUS_AVALIACAO,
  etapaAvaliacao,
  mensagemFormularioDisponivel,
  motivoSemCobrancaAvaliacao,
  type StatusAvaliacao,
} from "@/lib/avaliacao-inicial";
import { STATUS_COBRANCA, type StatusCobranca } from "@/lib/cobrancas";
import { formatarMoeda } from "@/lib/financeiro";
import { linkWhatsapp, numeroWhatsapp } from "@/lib/lembrete-whatsapp";
import { erroAmigavel, fmtData } from "@/lib/ui-helpers";
import { NovaCobrancaDialog } from "@/components/cobrancas/NovaCobrancaDialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

/** Linha do tempo da avaliação inicial na ficha do paciente (some para pacientes antigos/importados). */
export function AvaliacaoInicialCard({ paciente, onVerFormulario }: { paciente: Tables<"pacientes">; onVerFormulario: () => void }) {
  const me = useMe();
  const clinica = useClinica();
  const qc = useQueryClient();
  const { data: av } = useSuspenseQuery(avaliacaoInicialQuery(paciente.id));
  const [cobrar, setCobrar] = useState(false);
  const [manual, setManual] = useState(false);
  if (!av || av.status === "dispensada") return null;

  const status = av.status as StatusAvaliacao;
  const etapa = etapaAvaliacao(status);
  const financeiro = podeGerirFinanceiro(me.papeis);
  const cob = av.cobranca;
  const motivo = motivoSemCobrancaAvaliacao(status, (cob?.status ?? null) as StatusCobranca | null);
  const st = STATUS_AVALIACAO[status];

  const contatos = [
    { nome: paciente.responsavel_nome, tel: paciente.responsavel_telefone, email: paciente.responsavel_email },
    { nome: paciente.responsavel2_nome, tel: paciente.responsavel2_telefone, email: paciente.responsavel2_email },
  ].filter((c) => c.nome && numeroWhatsapp(c.tel));

  return (
    <section className={cn("mb-6 rounded-2xl border p-5", status === "concluida" ? "border-success/40 bg-success/5" : "border-warning/50 bg-warning/10")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <ClipboardList className="mt-0.5 size-5 shrink-0 text-primary" />
          <div>
            <h2 className="font-semibold">Avaliação inicial</h2>
            <p className="text-sm text-muted-foreground">{st.descricao}</p>
          </div>
        </div>
        <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", st.className)}>{st.label}</span>
      </div>

      <ol className="mt-4 grid gap-2 sm:grid-cols-3">
        {ETAPAS_AVALIACAO.map((nome, i) => (
          <li
            key={nome}
            className={cn(
              "flex items-center gap-2 rounded-xl border bg-card px-3 py-2 text-sm",
              i < etapa || status === "concluida" ? "border-success/40" : i === etapa ? "border-primary/50 font-medium" : "opacity-60",
            )}
          >
            {i < etapa || status === "concluida" ? (
              <CheckCircle2 className="size-4 shrink-0 text-success" />
            ) : (
              <span className="flex size-4 shrink-0 items-center justify-center rounded-full border text-[10px]">{i + 1}</span>
            )}
            {nome}
          </li>
        ))}
      </ol>

      <div className="mt-4 space-y-2 text-sm">
        {av.pagamento_confirmado_em && (
          <p className="text-muted-foreground">
            Pagamento confirmado em {fmtData(av.pagamento_confirmado_em)}
            {av.pagamento_origem === "manual" ? " (recebido na clínica)" : " (cobrança paga)"}.
          </p>
        )}
        {status === "aguardando_pagamento" && financeiro && cob && (
          <p className="flex flex-wrap items-center gap-2">
            <Receipt className="size-4 text-muted-foreground" /> Cobrança de {formatarMoeda(Number(cob.valor))}, vence {fmtData(cob.vencimento)}
            <span className={cn("rounded-full px-2 py-0.5 text-xs", STATUS_COBRANCA[cob.status as StatusCobranca]?.className)}>
              {STATUS_COBRANCA[cob.status as StatusCobranca]?.label}
            </span>
            <Link to="/$clinica/financeiro" params={{ clinica }} search={{ aba: "cobrancas" } as never} className="text-primary hover:underline">
              Ver em Cobranças
            </Link>
          </p>
        )}
        {status === "aguardando_pagamento" && !financeiro && (
          <p className="text-muted-foreground">Peça ao financeiro para gerar a cobrança da avaliação (valor de uma sessão normal).</p>
        )}
        {status === "concluida" && av.preenchido_em && (
          <p className="text-muted-foreground">
            Formulário enviado por {av.preenchido_por_nome} em {fmtData(av.preenchido_em, "dd/MM/yyyy 'às' HH:mm")}.
          </p>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {status === "aguardando_pagamento" && financeiro && (
          <>
            <Button size="sm" onClick={() => setCobrar(true)} disabled={!!motivo} title={motivo ?? undefined}>
              <Wallet /> Gerar cobrança da avaliação
            </Button>
            <Button size="sm" variant="outline" onClick={() => setManual(true)}>
              <CheckCircle2 /> Pagamento recebido na clínica
            </Button>
          </>
        )}
        {status === "aguardando_formulario" &&
          contatos.map((c) => (
            <Button key={c.tel} size="sm" variant="outline" asChild>
              <a
                href={linkWhatsapp(
                  numeroWhatsapp(c.tel),
                  mensagemFormularioDisponivel({ responsavel: c.nome, crianca: paciente.nome, clinica: me.clinica?.nome ?? "clínica", email: c.email }),
                )}
                target="_blank"
                rel="noreferrer"
              >
                <MessageCircle /> Avisar {c.nome!.split(" ")[0]} pelo WhatsApp
              </a>
            </Button>
          ))}
        {status === "concluida" && podeVerDadosClinicos(me.papeis, me.especialidades) && (
          <Button size="sm" variant="outline" onClick={onVerFormulario}>
            <ClipboardList /> Ver formulário
          </Button>
        )}
      </div>

      {cobrar && (
        <NovaCobrancaDialog
          aberta
          pacienteFixo={paciente.id}
          avaliacaoInicial
          onClose={() => setCobrar(false)}
          onCriada={() => qc.invalidateQueries({ queryKey: ["avaliacao-inicial"] })}
        />
      )}
      {manual && <PagamentoManualDialog pacienteId={paciente.id} onClose={() => setManual(false)} />}
    </section>
  );
}

function PagamentoManualDialog({ pacienteId, onClose }: { pacienteId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [obs, setObs] = useState("");
  const [salvando, setSalvando] = useState(false);
  async function confirmar() {
    setSalvando(true);
    const { error } = await supabase.rpc("confirmar_pagamento_avaliacao", { _paciente: pacienteId, _observacao: obs });
    setSalvando(false);
    if (error) return void toast.error(erroAmigavel(error.message));
    toast.success("Pagamento confirmado. O formulário foi liberado na Área da família.");
    qc.invalidateQueries({ queryKey: ["avaliacao-inicial"] });
    onClose();
  }
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Pagamento recebido na clínica</DialogTitle>
          <DialogDescription>
            Use quando a família pagou por fora do link (dinheiro, maquininha, Pix direto). Fica registrado com seu nome na auditoria. Se houver
            uma cobrança aberta da avaliação, cancele-a no Financeiro.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="obs-pag">Como foi pago</Label>
          <Textarea id="obs-pag" rows={3} maxLength={500} value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Ex.: Pix na conta da clínica em 30/10, R$ 180,00" />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={confirmar} disabled={salvando || obs.trim().length < 5}>
            {salvando && <Loader2 className="animate-spin" />} Confirmar pagamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
