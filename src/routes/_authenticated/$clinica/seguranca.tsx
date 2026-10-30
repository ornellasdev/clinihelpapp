import { createFileRoute, Link, Outlet, redirect } from "@tanstack/react-router";
import { ScrollText, ShieldCheck } from "lucide-react";
import { meQuery } from "@/lib/queries";
import { podeVerAuditoria } from "@/lib/permissions";
import { useClinica } from "@/hooks/use-clinica";
import { PageHeader } from "@/components/PageHeader";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/$clinica/seguranca")({
  beforeLoad: async ({ context, params }) => {
    const me = await context.queryClient.ensureQueryData(meQuery);
    if (!podeVerAuditoria(me.papeis)) throw redirect({ to: "/$clinica/painel", params });
  },
  head: () => ({ meta: [{ title: "Segurança, Banco e Auditoria — CliniHelp" }] }),
  component: SegurancaLayout,
});

const aba = "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground";

function SegurancaLayout() {
  const clinica = useClinica();
  return (
    <div>
      <PageHeader
        titulo="Segurança, Banco e Auditoria"
        descricao="Conformidade com LGPD, ISO 27001, HIPAA e SOC 2, e o registro de tudo o que foi feito no sistema."
      />
      <nav className="mb-6 inline-flex flex-wrap gap-1 rounded-xl bg-surface p-1">
        <Link
          to="/$clinica/seguranca"
          params={{ clinica }}
          activeOptions={{ exact: true }}
          className={aba}
          activeProps={{ className: cn(aba, "!bg-card !text-foreground shadow-sm") }}
        >
          <ShieldCheck className="size-4" /> Conformidade
        </Link>
        <Link
          to="/$clinica/seguranca/auditoria"
          params={{ clinica }}
          className={aba}
          activeProps={{ className: cn(aba, "!bg-card !text-foreground shadow-sm") }}
        >
          <ScrollText className="size-4" /> Trilha de auditoria
        </Link>
      </nav>
      <Outlet />
    </div>
  );
}
