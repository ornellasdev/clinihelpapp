import { useEffect, useRef, useState } from "react";
import { Loader2, Mic, Square, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { iniciarGravacao, type Gravacao } from "@/lib/gravar-voz";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const LIMITE_SEG = 10 * 60;

/** Grava o relato, envia para a IA e devolve o texto para o profissional revisar no campo da evolução. */
export function VozEvolucao({
  especialidadeId,
  modelo,
  onTexto,
}: {
  especialidadeId: string;
  modelo: string;
  onTexto: (texto: string) => void;
}) {
  const [estado, setEstado] = useState<"parado" | "gravando" | "processando">("parado");
  const [seg, setSeg] = useState(0);
  const [nivel, setNivel] = useState(0);
  const grav = useRef<Gravacao | null>(null);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    if (estado !== "gravando") return;
    const t = setInterval(() => {
      setSeg((s) => s + 1);
    }, 1000);
    const n = setInterval(() => setNivel(grav.current?.nivel() ?? 0), 120);
    return () => {
      clearInterval(t);
      clearInterval(n);
    };
  }, [estado]);

  useEffect(() => {
    if (estado === "gravando" && seg >= LIMITE_SEG) void parar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seg, estado]);

  useEffect(
    () => () => {
      grav.current?.cancelar();
      abort.current?.abort();
    },
    [],
  );

  async function comecar() {
    if (!especialidadeId) {
      toast.error("Escolha a especialidade antes de gravar.");
      return;
    }
    try {
      grav.current = await iniciarGravacao();
      setSeg(0);
      setEstado("gravando");
    } catch (e) {
      const nome = e instanceof Error ? e.name : "";
      toast.error(
        nome === "NotAllowedError"
          ? "Permita o uso do microfone no navegador para gravar."
          : e instanceof Error
            ? e.message
            : "Não foi possível acessar o microfone.",
      );
    }
  }

  async function parar() {
    const g = grav.current;
    if (!g) return;
    grav.current = null;
    setEstado("processando");
    try {
      const arquivo = await g.parar();
      const { data } = await supabase.auth.getSession();
      const fd = new FormData();
      fd.append("audio", arquivo);
      fd.append("especialidade_id", especialidadeId);
      if (modelo) fd.append("modelo", modelo);
      abort.current = new AbortController();
      const res = await fetch("/api/evolucao-voz", {
        method: "POST",
        headers: { Authorization: `Bearer ${data.session?.access_token ?? ""}` },
        body: fd,
        signal: abort.current.signal,
      });
      const j = (await res.json().catch(() => ({}))) as { texto?: string; erro?: string; organizado?: boolean };
      if (!res.ok || !j.texto) throw new Error(j.erro ?? "Falha ao processar o áudio.");
      onTexto(j.texto);
      toast.success(j.organizado ? "Texto pronto. Revise antes de salvar." : "Transcrição pronta. Revise antes de salvar.");
    } catch (e) {
      if (!(e instanceof Error && e.name === "AbortError")) toast.error(e instanceof Error ? e.message : "Falha ao processar o áudio.");
    } finally {
      abort.current = null;
      setEstado("parado");
    }
  }

  function cancelar() {
    grav.current?.cancelar();
    grav.current = null;
    abort.current?.abort();
    setEstado("parado");
  }

  const mmss = `${String(Math.floor(seg / 60)).padStart(2, "0")}:${String(seg % 60).padStart(2, "0")}`;

  if (estado === "parado")
    return (
      <Button type="button" variant="secondary" onClick={comecar} className="w-full sm:w-auto">
        <Mic /> Ditar por voz
      </Button>
    );

  return (
    <div className="flex w-full items-center gap-3 rounded-xl border border-primary/30 bg-secondary/40 px-3 py-2 sm:w-auto">
      {estado === "gravando" ? (
        <>
          <span className="relative flex size-3">
            <span
              className="absolute inline-flex size-full rounded-full bg-destructive opacity-60"
              style={{ transform: `scale(${1 + Math.min(1.5, nivel * 4)})` }}
            />
            <span className="relative inline-flex size-3 rounded-full bg-destructive" />
          </span>
          <span className="font-mono text-sm tabular-nums">{mmss}</span>
          <span className="hidden text-xs text-muted-foreground sm:inline">Fale sobre a sessão…</span>
          <Button type="button" size="sm" onClick={parar} className="ml-auto">
            <Square /> Concluir
          </Button>
        </>
      ) : (
        <>
          <Loader2 className="size-4 animate-spin text-primary" />
          <span className="text-sm">Escrevendo o texto…</span>
        </>
      )}
      <Button type="button" size="icon" variant="ghost" onClick={cancelar} aria-label="Cancelar gravação" className={cn(estado === "processando" && "ml-auto")}>
        <X />
      </Button>
    </div>
  );
}
