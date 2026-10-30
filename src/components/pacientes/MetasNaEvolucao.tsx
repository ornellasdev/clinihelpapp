import { Target } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import { NIVEIS } from "@/lib/plano-terapeutico";
import { cn } from "@/lib/utils";

/** Para cada meta ativa da especialidade, o profissional toca no nível alcançado na sessão. */
export function MetasNaEvolucao({
  metas,
  niveis,
  onChange,
}: {
  metas: Tables<"plano_metas">[];
  niveis: Record<string, number>;
  onChange: (metaId: string, nivel: number | null) => void;
}) {
  if (metas.length === 0) return null;
  return (
    <div className="mt-4 rounded-xl border bg-surface p-3">
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
        <Target className="size-4 text-primary" /> Progresso nas metas
        <span className="text-xs font-normal text-muted-foreground">(opcional)</span>
      </div>
      <div className="space-y-3">
        {metas.map((m) => (
          <div key={m.id}>
            <div className="mb-1 text-sm">{m.titulo}</div>
            <div className="grid grid-cols-5 gap-1" role="radiogroup" aria-label={m.titulo}>
              {NIVEIS.map((n) => {
                const ativo = niveis[m.id] === n.valor;
                return (
                  <button
                    key={n.valor}
                    type="button"
                    role="radio"
                    aria-checked={ativo}
                    title={n.label}
                    onClick={() => onChange(m.id, ativo ? null : n.valor)}
                    className={cn(
                      "flex min-h-11 flex-col items-center justify-center rounded-lg border bg-card px-1 py-1 text-center leading-tight transition-colors",
                      ativo ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted",
                    )}
                  >
                    <span className="text-sm font-semibold">{n.valor}</span>
                    <span className="text-[10px]">{n.curto}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
