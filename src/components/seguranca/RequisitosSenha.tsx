import { Check, X } from "lucide-react";
import { avaliarSenha } from "@/lib/senha";
import { cn } from "@/lib/utils";

/** Lista as regras de senha segura, marcando as já cumpridas. */
export function RequisitosSenha({ senha, className }: { senha: string; className?: string }) {
  return (
    <ul className={cn("grid gap-1 text-xs", className)} aria-label="Requisitos da senha">
      {avaliarSenha(senha).map((r) => (
        <li key={r.id} className={cn("flex items-center gap-1.5", r.ok ? "text-success" : "text-muted-foreground")}>
          {r.ok ? <Check className="size-3.5 shrink-0" /> : <X className="size-3.5 shrink-0" />}
          {r.label}
        </li>
      ))}
    </ul>
  );
}
