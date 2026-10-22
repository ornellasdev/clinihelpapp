import icone from "@/assets/clinihelp-icone.png";
import { cn } from "@/lib/utils";

export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <img src={icone} alt={compact ? "CliniHelp" : ""} className="size-9 shrink-0 object-contain" width={36} height={36} />
      {!compact && (
        <div className="leading-none">
          <div className="font-display text-xl font-bold tracking-tight">
            Clini<span className="text-sidebar-primary">Help</span>
          </div>
          <div className="mt-1 font-display text-[10px] font-semibold uppercase tracking-[0.16em] opacity-70">
            Gestão de clínicas
          </div>
        </div>
      )}
    </div>
  );
}
