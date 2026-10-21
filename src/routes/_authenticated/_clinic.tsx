import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  CalendarDays,
  DoorOpen,
  LayoutDashboard,
  LogOut,
  Menu,
  ShieldAlert,
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

export const Route = createFileRoute("/_authenticated/_clinic")({
  loader: ({ context }) => context.queryClient.ensureQueryData(meQuery),
  component: ClinicLayout,
});

type Item = { to: string; label: string; icon: LucideIcon; papeis?: Papel[] };
const ITENS: Item[] = [
  { to: "/painel", label: "Painel", icon: LayoutDashboard },
  { to: "/agenda", label: "Agenda", icon: CalendarDays },
  { to: "/pacientes", label: "Pacientes", icon: Users },
  { to: "/financeiro", label: "Financeiro", icon: Wallet, papeis: ["master", "financeiro", "profissional"] },
  { to: "/equipe", label: "Equipe", icon: UserRoundCog, papeis: ["master"] },
  { to: "/salas", label: "Salas", icon: DoorOpen, papeis: ["master"] },
];

function ClinicLayout() {
  const me = useMe();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [menuAberto, setMenuAberto] = useState(false);

  async function sair() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  if (me.papeis.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="max-w-sm text-center">
          <ShieldAlert className="mx-auto size-10 text-warning" />
          <h1 className="mt-4 text-xl font-semibold">Acesso não liberado</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Sua conta ainda não tem um perfil de acesso ativo. Fale com o administrador da clínica.
          </p>
          <Button className="mt-6" variant="outline" onClick={sair}>
            Sair
          </Button>
        </div>
      </div>
    );
  }

  const itens = ITENS.filter((i) => !i.papeis || temPapel(me.papeis, ...i.papeis)).map((i) =>
    i.to === "/financeiro" && !temPapel(me.papeis, "master", "financeiro") ? { ...i, label: "Meus repasses" } : i,
  );
  const principais = itens.slice(0, 4);
  const papelLabel = me.papeis.map((p) => PAPEIS.find((x) => x.value === p)?.label).join(" · ");

  const navLinks = (onClick?: () => void) =>
    itens.map((i) => (
      <Link
        key={i.to}
        to={i.to}
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
      <button onClick={sair} className="rounded-lg p-2 text-sidebar-foreground/70 hover:bg-sidebar hover:text-sidebar-foreground" aria-label="Sair">
        <LogOut className="size-4" />
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-sidebar p-4 text-sidebar-foreground md:flex">
        <Logo className="px-2 py-3" />
        <nav className="mt-6 flex flex-1 flex-col gap-1">{navLinks()}</nav>
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
