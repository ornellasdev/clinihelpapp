import { createFileRoute, Outlet, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Lock, MailCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { enviarCodigoFamilia } from "@/lib/familia.functions";
import { normalizarEmail } from "@/lib/familia";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const DESC = "Agenda da criança, cobranças, recibos, relatórios e termos da clínica — acesso dos pais e responsáveis.";

export const Route = createFileRoute("/familia")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Área da família — CliniHelp" },
      { name: "description", content: DESC },
      { property: "og:title", content: "Área da família — CliniHelp" },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    return { familiaEmail: data.user?.email ?? null };
  },
  component: FamiliaLayout,
});

export function MolduraFamilia({ children, direita }: { children: React.ReactNode; direita?: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="bg-sidebar px-4 py-4 text-sidebar-foreground">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
          <Logo />
          {direita}
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-4 py-6">{children}</main>
      <footer className="flex items-center justify-center gap-1.5 pb-8 text-xs text-muted-foreground">
        <Lock className="size-3" /> Área da família · CliniHelp
      </footer>
    </div>
  );
}

function FamiliaLayout() {
  const { familiaEmail } = Route.useRouteContext();
  if (!familiaEmail) return <EntrarFamilia />;
  return <Outlet />;
}

function EntrarFamilia() {
  const router = useRouter();
  const enviar = useServerFn(enviarCodigoFamilia);
  const [etapa, setEtapa] = useState<"email" | "codigo">("email");
  const [email, setEmail] = useState("");
  const [codigo, setCodigo] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [aviso, setAviso] = useState("");

  async function pedirCodigo(e: React.FormEvent) {
    e.preventDefault();
    setCarregando(true);
    try {
      const r = await enviar({ data: { email: normalizarEmail(email) } });
      setAviso(r.mensagem);
      setEtapa("codigo");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível enviar o código.");
    } finally {
      setCarregando(false);
    }
  }

  async function confirmar(e: React.FormEvent) {
    e.preventDefault();
    setCarregando(true);
    const { error } = await supabase.auth.verifyOtp({ email: normalizarEmail(email), token: codigo.replace(/\D/g, ""), type: "email" });
    setCarregando(false);
    if (error) {
      toast.error(/expired|invalid/i.test(error.message) ? "Código inválido ou vencido. Peça um novo." : "Não foi possível entrar. Tente novamente.");
      return;
    }
    router.invalidate();
  }

  return (
    <MolduraFamilia>
      <div className="mx-auto max-w-sm rounded-2xl border bg-card p-6">
        {etapa === "email" ? (
          <form onSubmit={pedirCodigo} className="space-y-5">
            <div>
              <h1 className="text-2xl font-semibold">Área da família</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Para pais e responsáveis. Use o e-mail que está na ficha da criança na clínica — enviaremos um código de acesso.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Seu e-mail</Label>
              <Input id="email" type="email" inputMode="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <Button type="submit" className="h-11 w-full" disabled={carregando}>
              {carregando && <Loader2 className="animate-spin" />} Receber código
            </Button>
          </form>
        ) : (
          <form onSubmit={confirmar} className="space-y-5">
            <div className="flex items-start gap-3">
              <MailCheck className="mt-0.5 size-6 shrink-0 text-primary" />
              <p className="text-sm text-muted-foreground">{aviso}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="codigo">Código recebido</Label>
              <Input
                id="codigo"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={10}
                required
                className="h-12 text-center font-mono text-xl tracking-[0.4em]"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))}
              />
              <p className="text-xs text-muted-foreground">Se o e-mail trouxer um botão ou link de acesso, você também pode tocar nele.</p>
            </div>
            <Button type="submit" className="h-11 w-full" disabled={carregando || codigo.length < 6}>
              {carregando && <Loader2 className="animate-spin" />} Entrar
            </Button>
            <Button type="button" variant="ghost" className="w-full" onClick={() => (setEtapa("email"), setCodigo(""))}>
              Usar outro e-mail
            </Button>
          </form>
        )}
      </div>
    </MolduraFamilia>
  );
}
