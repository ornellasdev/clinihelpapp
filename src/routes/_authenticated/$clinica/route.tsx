import { createFileRoute, Link, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  ArrowLeftRight,
  CalendarDays,
  ChartColumn,
  DoorOpen,
  Hourglass,
  LayoutDashboard,
  LogOut,
  Menu,
  ShieldAlert,
  Receipt,
  ScrollText,
  Users,
  UserRoundCog,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { meQuery } from "@/lib/queries";
import { useMe } from "@/hooks/use-me";
import { PAPEIS, temPapel, type Papel } from "@/lib/permissions";
import { iniciais } from "@/lib/ui-helpers";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/$clinica")({
  beforeLoad: async ({ context, params, location }) => {
    let me = await context.queryClient.ensureQueryData(meQuery);
    if (me.dev_pendente) throw redirect({ to: "/dev" });
    if (me.dev && me.clinica?.slug !== params.clinica) {
      // Desenvolvedor abrindo outra clínica: troca a clínica ativa e descarta dados da anterior.
      const { error } = await supabase.rpc("dev_entrar_clinica", { _slug: params.clinica });
      if (error) throw redirect({ to: "/dev" });
      context.queryClient.clear();
      me = await context.queryClient.fetchQuery(meQuery);
    }
    if (!me.dev && me.clinica && me.clinica.slug !== params.clinica) {
      const resto = location.pathname.split("/").slice(2).join("/");
      throw redirect({ href: `/${me.clinica.slug}/${resto || "painel"}` });
    }
  },
  loader: ({ context }) => context.queryClient.ensureQueryData(meQuery),
  component: ClinicLayout,
});

type Item = {
  to:
    | "/$clinica/painel"
    | "/$clinica/agenda"
    | "/$clinica/pacientes"
    | "/$clinica/financeiro"
    | "/$clinica/cobrancas"
    | "/$clinica/espera"
    | "/$clinica/indicadores"
    | "/$clinica/equipe"
    | "/$clinica/salas"
    | "/$clinica/auditoria";
  label: string;
  icon: LucideIcon;
  papeis?: Papel[];
};
const ITENS: Item[] = [
  { to: "/$clinica/painel", label: "Painel", icon: LayoutDashboard },
  { to: "/$clinica/agenda", label: "Agenda", icon: CalendarDays },
  { to: "/$clinica/pacientes", label: "Pacientes", icon: Users },
  { to: "/$clinica/financeiro", label: "Financeiro", icon: Wallet, papeis: ["master", "administrador", "financeiro", "profissional"] },
  { to: "/$clinica/cobrancas", label: "Cobranças", icon: Receipt, papeis: ["master", "administrador", "financeiro"] },
  { to: "/$clinica/espera", label: "Lista de espera", icon: Hourglass },
  { to: "/$clinica/indicadores", label: "Indicadores (KPI)", icon: ChartColumn, papeis: ["master", "administrador", "financeiro"] },
  { to: "/$clinica/equipe", label: "Equipe", icon: UserRoundCog, papeis: ["master", "administrador"] },
  { to: "/$clinica/salas", label: "Salas", icon: DoorOpen, papeis: ["master", "administrador"] },
  { to: "/$clinica/auditoria", label: "Auditoria", icon: ScrollText, papeis: ["master", "administrador"] },
];

function ClinicLayout() {
  const me = useMe();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [menuAberto, setMenuAberto] = useState(false);

  async function sair() {
    if (me.dev) {
      await queryClient.cancelQueries();
      queryClient.clear();
      navigate({ to: "/dev", replace: true });
      return;
    }
    await supabase.rpc("registrar_acesso", { _acao: "logout" });
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  if (me.papeis.length === 0 || !me.clinica) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="max-w-sm text-center">
          <ShieldAlert className="mx-auto size-10 text-warning" />
          <h1 className="mt-4 text-xl font-semibold">Acesso não liberado</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {me.clinica && !me.clinica.ativa
              ? "O acesso desta clínica está suspenso. Entre em contato com o suporte CliniHelp."
              : "Sua conta ainda não tem um perfil de acesso ativo. Fale com o administrador da clínica."}
          </p>
          <Button className="mt-6" variant="outline" onClick={sair}>
            Sair
          </Button>
        </div>
      </div>
    );
  }

  const itens = ITENS.filter((i) => !i.papeis || temPapel(me.papeis, ...i.papeis)).map((i) =>
    i.to === "/$clinica/financeiro" && !temPapel(me.papeis, "master", "administrador", "financeiro") ? { ...i, label: "Meus repasses" } : i,
  );
  const principais = itens.slice(0, 4);
  const papelLabel = me.papeis.map((p) => PAPEIS.find((x) => x.value === p)?.label).join(" · ");

  const navLinks = (onClick?: () => void) =>
    itens.map((i) => (
      <Link
        key={i.to}
        to={i.to}
        params={{ clinica: me.clinica?.slug ?? "" }}
        onClick={onClick}
        className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        activeProps={{ className: "!bg-sidebar-accent !text-sidebar-accent-foreground" }}
      >
        <i.icon className="size-[18px]" />
        {i.label}
      </Link>
    ));

  const perfil = (
    <div className="flex items-center gap-3 rounded-xl bg-sidebar-accent/60 p-3">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sidebar-primary text-sm font-semibold text-sidebar-primary-foreground">
        {iniciais(me.nome)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{me.nome}</div>
        <div className="truncate text-xs text-sidebar-foreground/60">{papelLabel}</div>
      </div>
      <button onClick={sair} className="rounded-lg p-2 text-sidebar-foreground/70 hover:bg-sidebar hover:text-sidebar-foreground" aria-label={me.dev ? "Trocar de clínica" : "Sair"} title={me.dev ? "Trocar de clínica" : "Sair"}>
        {me.dev ? <ArrowLeftRight className="size-4" /> : <LogOut className="size-4" />}
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-sidebar p-4 text-sidebar-foreground md:flex">
        <Logo className="px-2 py-3" />
        <NomeClinica nome={me.clinica.nome} dev={me.dev} />
        <nav className="mt-4 flex flex-1 flex-col gap-1">{navLinks()}</nav>
        {perfil}
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between bg-sidebar px-4 py-3 text-sidebar-foreground md:hidden">
        <Logo />
        <button onClick={() => setMenuAberto(true)} className="rounded-lg p-2" aria-label="Abrir menu">
          <Menu className="size-5" />
        </button>
      </header>
      <Sheet open={menuAberto} onOpenChange={setMenuAberto}>
        <SheetContent side="right" className="flex w-72 flex-col border-sidebar-border bg-sidebar p-4 text-sidebar-foreground">
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <Logo className="px-2 py-3" />
          <NomeClinica nome={me.clinica.nome} dev={me.dev} />
          <nav className="mt-4 flex flex-1 flex-col gap-1">{navLinks(() => setMenuAberto(false))}</nav>
          {perfil}
        </SheetContent>
      </Sheet>

      <main className="px-4 pb-28 pt-5 md:ml-64 md:px-8 md:pb-10 md:pt-8">
        <div className="mx-auto max-w-7xl">
          <Outlet />
        </div>
      </main>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        {principais.map((i) => (
          <Link
            key={i.to}
            to={i.to}
            params={{ clinica: me.clinica?.slug ?? "" }}
            className={cn("flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium text-muted-foreground")}
            activeProps={{ className: "!text-primary" }}
          >
            <i.icon className="size-5" />
            {i.label === "Meus repasses" ? "Repasses" : i.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}

function NomeClinica({ nome, dev }: { nome: string; dev: boolean }) {
  return (
    <div className="mt-2 rounded-xl border border-sidebar-border px-3 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/50">
        {dev ? "Acesso desenvolvedor" : "Clínica"}
      </div>
      <div className="truncate text-sm font-medium">{nome}</div>
    </div>
  );
}
