import { cn } from "@/lib/utils";

export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <svg viewBox="0 0 32 32" className="size-8 shrink-0" aria-hidden>
        <circle cx="16" cy="16" r="15" className="fill-sidebar-primary" />
        <path d="M16 25c0-6 0-9 0-11" className="stroke-sidebar" strokeWidth="2.2" strokeLinecap="round" fill="none" />
        <path d="M16 15c-4.5 0-7-2.6-7-7 4.5 0 7 2.6 7 7Z" className="fill-sidebar" />
        <path d="M16 18c4 0 6.5-2.3 6.5-6.2-4 0-6.5 2.3-6.5 6.2Z" className="fill-sidebar" opacity=".75" />
      </svg>
      {!compact && (
        <div className="leading-tight">
          <div className="font-display text-lg font-semibold">Florescer</div>
          <div className="text-[11px] uppercase tracking-[0.14em] opacity-70">Gestão clínica</div>
        </div>
      )}
    </div>
  );
}
