import { Paperclip } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const BUCKET_DOCUMENTOS = "documentos-pacientes";

type Doc = { id: string; nome: string; storage_path: string };

/** Abre o arquivo numa nova aba (a aba abre antes do link assinado para não ser barrada pelo navegador). */
export async function abrirDocumento(path: string) {
  const aba = window.open("", "_blank");
  const { data, error } = await supabase.storage.from(BUCKET_DOCUMENTOS).createSignedUrl(path, 120);
  if (error || !data) {
    aba?.close();
    toast.error("Não foi possível abrir o arquivo.");
    return;
  }
  if (aba) {
    aba.opener = null;
    aba.location.href = data.signedUrl;
  } else {
    window.location.assign(data.signedUrl);
  }
}

/** Clipe na agenda para abrir rápido o atestado/comprovante da falta justificada. */
export function ClipeAtestado({ docs, className }: { docs: readonly Doc[] | null | undefined; className?: string }) {
  const doc = docs?.[0];
  if (!doc) return null;
  const titulo = docs!.length > 1 ? `${docs!.length} anexos — abrir ${doc.nome}` : `Abrir atestado: ${doc.nome}`;
  return (
    <button
      type="button"
      title={titulo}
      aria-label={titulo}
      onClick={(e) => {
        e.stopPropagation();
        void abrirDocumento(doc.storage_path);
      }}
      className={cn(
        "inline-flex size-6 shrink-0 items-center justify-center rounded-md border bg-card text-foreground shadow-sm hover:bg-muted",
        className,
      )}
    >
      <Paperclip className="size-3.5" />
    </button>
  );
}
