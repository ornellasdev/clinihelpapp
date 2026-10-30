import { createFileRoute, Link } from "@tanstack/react-router";
import {
  CalendarDays, FileCheck2, Lock, Mic, MessageCircle, Receipt, Target, Users, ShieldCheck, Scale, CheckCircle2,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";

const TITULO = "CliniHelp — Gestão completa para clínicas de desenvolvimento infantil";
const DESC = "Agenda sem conflitos, evolução por voz com IA, guias de convênio sem glosas, metas terapêuticas, lembretes por WhatsApp e cobranças Pix/boleto/cartão.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: TITULO },
      { name: "description", content: DESC },
      { property: "og:title", content: TITULO },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const destaques = [
  { icon: Mic, titulo: "Evolução por voz com IA", texto: "O terapeuta fala no celular, a IA organiza o texto e ele revisa antes de salvar." },
  { icon: FileCheck2, titulo: "Guias e glosas sob controle", texto: "Códigos TUSS, guia e faturamento, liberação diária e baixa automática de saldo." },
  { icon: Target, titulo: "Plano terapêutico com metas", texto: "Objetivos por especialidade e gráfico de progresso para pais e convênios." },
  { icon: CalendarDays, titulo: "Agenda sala × profissional", texto: "Conflitos de horário impossíveis, fila do terapeuta e status com cores." },
  { icon: MessageCircle, titulo: "Lembretes por WhatsApp", texto: "Mensagem pronta em 1 toque para confirmar a sessão e reduzir faltas." },
  { icon: Receipt, titulo: "Cobranças Pix, boleto e cartão", texto: "Na sua própria conta, sem taxa do CliniHelp, com página de pagamento para os pais." },
  { icon: Scale, titulo: "Liminares sem planilha", texto: "Lista de presença em PDF, nota fiscal e vencimento de 30 dias calculado." },
  { icon: Users, titulo: "Área dos responsáveis", texto: "Pais veem agenda, cobranças, relatórios e assinam termos pelo celular." },
];

const seguranca = [
  "Prontuário que não pode ser apagado — correções por adendo",
  "Recepção não vê diagnóstico nem valores",
  "Senha forte e verificação em 2 etapas para toda a equipe",
  "Trilha de auditoria permanente e painel LGPD",
];

const especialidades = ["Fonoaudiologia", "Terapia Ocupacional", "Psicologia", "Fisioterapia", "Psicopedagogia", "ABA", "Psicomotricidade"];

function Index() {
  return (
    <div className="min-h-screen bg-sidebar text-sidebar-foreground">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Logo />
        <Button asChild variant="secondary"><Link to="/auth">Entrar</Link></Button>
      </header>

      <main>
        <section className="mx-auto max-w-6xl px-6 pb-16 pt-8 md:pt-16">
          <div className="flex flex-wrap gap-2">
            {["IA por voz", "LGPD", "Zero glosas"].map((b) => (
              <span key={b} className="rounded-full border border-sidebar-border bg-sidebar-accent/60 px-3 py-1 text-xs font-medium text-sidebar-primary">{b}</span>
            ))}
          </div>
          <h1 className="mt-6 max-w-4xl text-4xl font-semibold leading-[1.05] md:text-6xl">
            A clínica inteira em um só lugar. Mais tempo para cada criança.
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-sidebar-foreground/75">
            Agenda, prontuário, convênios, liminares e cobranças para clínicas multidisciplinares de desenvolvimento infantil — feito para usar no celular, entre uma sessão e outra.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg" className="h-12 bg-gradient-brand px-8 font-semibold text-sidebar-primary-foreground hover:opacity-90">
              <a href="https://www.linkedin.com/in/yurivillarornelas/" target="_blank" rel="noreferrer">Quero uma demonstração</a>
            </Button>
            <Button asChild size="lg" variant="secondary" className="h-12 px-8"><Link to="/auth">Acessar o sistema</Link></Button>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 py-12">
          <h2 className="text-2xl font-semibold md:text-3xl">O que sua clínica ganha</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {destaques.map((r) => (
              <div key={r.titulo} className="rounded-2xl border border-sidebar-border bg-sidebar-accent/50 p-5">
                <r.icon className="size-6 text-sidebar-primary" />
                <h3 className="mt-4 text-base font-semibold">{r.titulo}</h3>
                <p className="mt-1 text-sm text-sidebar-foreground/70">{r.texto}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 py-12">
          <h2 className="text-2xl font-semibold md:text-3xl">Para todas as especialidades</h2>
          <p className="mt-2 text-sidebar-foreground/70">Cada prontuário só é visto por quem atende aquela especialidade.</p>
          <div className="mt-6 flex flex-wrap gap-2">
            {especialidades.map((e) => (
              <span key={e} className="rounded-xl border border-sidebar-border px-4 py-2 text-sm">{e}</span>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 py-12">
          <div className="grid gap-8 rounded-3xl border border-sidebar-border bg-sidebar-accent/40 p-8 md:grid-cols-2 md:p-12">
            <div>
              <ShieldCheck className="size-8 text-sidebar-primary" />
              <h2 className="mt-4 text-2xl font-semibold md:text-3xl">Segurança de dados de saúde e de crianças</h2>
              <p className="mt-3 text-sidebar-foreground/70">Construído seguindo LGPD, ISO 27001 e boas práticas HIPAA.</p>
            </div>
            <ul className="space-y-3">
              {seguranca.map((s) => (
                <li key={s} className="flex gap-3"><CheckCircle2 className="mt-0.5 size-5 shrink-0 text-sidebar-primary" /><span>{s}</span></li>
              ))}
            </ul>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 py-16 text-center">
          <Lock className="mx-auto size-6 text-sidebar-primary" />
          <h2 className="mt-4 text-3xl font-semibold md:text-4xl">Pronto para organizar sua clínica?</h2>
          <p className="mx-auto mt-3 max-w-xl text-sidebar-foreground/70">Nós migramos seus pacientes e convênios do sistema antigo para você começar sem retrabalho.</p>
          <Button asChild size="lg" className="mt-8 h-12 bg-gradient-brand px-8 font-semibold text-sidebar-primary-foreground hover:opacity-90">
            <a href="https://www.linkedin.com/in/yurivillarornelas/" target="_blank" rel="noreferrer">Falar com o CliniHelp</a>
          </Button>
        </section>
      </main>

      <footer className="border-t border-sidebar-border py-6 text-center text-sm text-sidebar-foreground/60">
        © {new Date().getFullYear()} CliniHelp — Cada evolução registrada é um passo da criança.
      </footer>
    </div>
  );
}
