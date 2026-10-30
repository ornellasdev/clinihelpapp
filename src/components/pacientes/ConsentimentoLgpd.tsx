import { ShieldCheck, ShieldAlert, ShieldX } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import { fmtData } from "@/lib/ui-helpers";
import { cn } from "@/lib/utils";

const SITUACAO = {
  assinado: { label: "Consentimento LGPD assinado", icon: ShieldCheck, classe: "border-success/40 bg-success/10" },
  revogado: { label: "Consentimento LGPD revogado", icon: ShieldX, classe: "border-destructive/40 bg-destructive/10" },
  pendente: { label: "Consentimento LGPD pendente", icon: ShieldAlert, classe: "border-warning/50 bg-warning/15" },
} as const;

/** Situação do termo de consentimento dos responsáveis (registrada pelo banco quando a família assina). */
export function ConsentimentoLgpd({ paciente }: { paciente: Tables<"pacientes"> }) {
  const st = (paciente.lgpd_consentimento_status in SITUACAO ? paciente.lgpd_consentimento_status : "pendente") as keyof typeof SITUACAO;
  const s = SITUACAO[st];
  return (
    <div className={cn("flex items-start gap-3 rounded-2xl border p-4 text-sm", s.classe)}>
      <s.icon className="mt-0.5 size-5 shrink-0" />
      <div>
        <div className="font-medium">{s.label}</div>
        <div className="text-muted-foreground">
          {st === "assinado" && paciente.lgpd_consentimento_em
            ? `Em ${fmtData(paciente.lgpd_consentimento_em, "dd/MM/yyyy")}${paciente.lgpd_consentimento_cpf ? ` · CPF de quem assinou terminado em ${paciente.lgpd_consentimento_cpf.replace(/\D/g, "").slice(-2)}` : ""}.`
            : st === "revogado"
              ? "A família retirou o consentimento. Fale com a coordenação antes de novos atendimentos."
              : "Peça a assinatura do termo de consentimento de tratamento na aba Família. Ao assinar, fica registrado aqui."}
        </div>
      </div>
    </div>
  );
}
