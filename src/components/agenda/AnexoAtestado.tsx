import { Paperclip } from "lucide-react";
import { BUCKETS, abrirArquivoPrivado } from "@/services/arquivos";
import { cn } from "@/lib/utils";

type Doc = { id: string; nome: string; storage_path: string };

/** Abre o atestado/documento por link temporário (2 min), gerado só na hora do clique. */
export const abrirDocumento = (path: string) => abrirArquivoPrivado(BUCKETS.documentos, path);

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
