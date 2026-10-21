import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarDays, FileText, Lock, Wallet } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Florescer — Gestão para clínicas de atendimento infantil" },
      {
        name: "description",
        content: "Agenda por sala e profissional, prontuário por especialidade, documentos e repasses para clínicas de crianças com necessidades especiais.",
      },
      { property: "og:title", content: "Florescer — Gestão para clínicas de atendimento infantil" },
      {
        property: "og:description",
        content: "Agenda, prontuário por especialidade, documentos e repasses em um só lugar.",
      },
    ],
  }),
  component: Index,
});

const recursos = [
  { icon: CalendarDays, titulo: "Agenda sala × profissional", texto: "Sem conflitos de horário, com visão por sala." },
  { icon: FileText, titulo: "Prontuário com assinatura", texto: "Evoluções com nome e registro do profissional." },
  { icon: Lock, titulo: "Acesso por especialidade", texto: "Psicologia só para psicólogas e o acesso master." },
  { icon: Wallet, titulo: "Valores e repasses", texto: "Percentual ajustável em cada sessão." },
];

function Index() {
  return (
    <div className="min-h-screen bg-sidebar text-sidebar-foreground">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Logo />
        <Button asChild variant="secondary">
          <Link to="/painel">Entrar</Link>
        </Button>
      </header>
      <main className="mx-auto max-w-6xl px-6 pb-20 pt-10 md:pt-20">
        <p className="text-sm uppercase tracking-[0.2em] text-sidebar-primary">Para clínicas de atendimento infantil</p>
        <h1 className="mt-4 max-w-3xl text-4xl font-semibold leading-[1.05] md:text-6xl">
          Menos papelada, mais tempo para cada criança.
        </h1>
        <p className="mt-6 max-w-xl text-lg text-sidebar-foreground/75">
          Agenda, prontuário, documentos e financeiro da clínica — pensado para registrar evoluções direto do celular.
        </p>
        <Button asChild size="lg" className="mt-8 h-12 bg-sidebar-primary px-8 text-sidebar-primary-foreground hover:bg-sidebar-primary/90">
          <Link to="/painel">Acessar o sistema</Link>
        </Button>

        <div className="mt-20 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {recursos.map((r) => (
            <div key={r.titulo} className="rounded-2xl border border-sidebar-border bg-sidebar-accent/50 p-5">
              <r.icon className="size-6 text-sidebar-primary" />
              <h2 className="mt-4 text-base font-semibold">{r.titulo}</h2>
              <p className="mt-1 text-sm text-sidebar-foreground/70">{r.texto}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
