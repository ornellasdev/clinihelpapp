import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { criarMasterInicial } from "@/lib/equipe.functions";
import { erroAmigavel } from "@/lib/ui-helpers";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar — CliniHelp" },
      { name: "description", content: "Acesso da equipe da clínica à agenda, prontuários e financeiro." },
      { property: "og:title", content: "Entrar — CliniHelp" },
      { property: "og:description", content: "Acesso da equipe da clínica à agenda, prontuários e financeiro." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [modo, setModo] = useState<"carregando" | "login" | "setup">("carregando");
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [enviando, setEnviando] = useState(false);
  const criarMaster = useServerFn(criarMasterInicial);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/painel", replace: true });
    });
    supabase.rpc("master_exists").then(({ data }) => setModo(data === false ? "setup" : "login"));
  }, [navigate]);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
    setEnviando(false);
    if (error) { toast.error(erroAmigavel(error.message)); return; }
    await supabase.rpc("registrar_acesso", { _acao: "login" });
    navigate({ to: "/painel", replace: true });
  }

  async function configurar(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    try {
      await criarMaster({ data: { nome, email, password: senha } });
      const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
      if (error) throw error;
      await supabase.rpc("registrar_acesso", { _acao: "login" });
      toast.success("Conta master criada!");
      navigate({ to: "/painel", replace: true });
    } catch (err) {
      toast.error(erroAmigavel((err as Error).message));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-sidebar p-12 text-sidebar-foreground lg:flex lg:flex-col lg:justify-between">
        <Logo />
        <div className="relative z-10 max-w-md">
          <h1 className="text-4xl font-semibold leading-tight">
            Cada evolução registrada é um passo da criança.
          </h1>
          <p className="mt-4 text-sidebar-foreground/75">
            Agenda por sala e profissional, prontuário por especialidade e repasses organizados — no computador ou no
            celular.
          </p>
        </div>
        <div className="pointer-events-none absolute -bottom-24 -right-24 size-96 rounded-full bg-sidebar-primary/20" />
        <div className="pointer-events-none absolute bottom-32 right-40 size-40 rounded-full bg-sidebar-accent" />
        <p className="relative z-10 text-xs text-sidebar-foreground/60">Acesso restrito à equipe da clínica.</p>
      </aside>

      <main className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 rounded-2xl bg-sidebar p-4 text-sidebar-foreground lg:hidden">
            <Logo />
          </div>
          {modo === "carregando" && <Loader2 className="mx-auto size-6 animate-spin text-muted-foreground" />}

          {modo === "login" && (
            <form onSubmit={entrar} className="space-y-5">
              <div>
                <h2 className="text-2xl font-semibold">Entrar</h2>
                <p className="mt-1 text-sm text-muted-foreground">Use o e-mail e a senha fornecidos pela clínica.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="senha">Senha</Label>
                <Input id="senha" type="password" autoComplete="current-password" required value={senha} onChange={(e) => setSenha(e.target.value)} />
              </div>
              <Button type="submit" className="h-11 w-full" disabled={enviando}>
                {enviando && <Loader2 className="animate-spin" />} Entrar
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                Esqueceu a senha? Peça ao administrador (acesso master) para redefinir.
              </p>
            </form>
          )}

          {modo === "setup" && (
            <form onSubmit={configurar} className="space-y-5">
              <div>
                <span className="inline-block rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">
                  Primeiro acesso
                </span>
                <h2 className="mt-3 text-2xl font-semibold">Criar conta master</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Esta conta terá acesso total e poderá cadastrar o restante da equipe.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="nome">Nome completo</Label>
                <Input id="nome" required value={nome} onChange={(e) => setNome(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="senha">Senha (mínimo 8 caracteres)</Label>
                <Input id="senha" type="password" minLength={8} required value={senha} onChange={(e) => setSenha(e.target.value)} />
              </div>
              <Button type="submit" className="h-11 w-full" disabled={enviando}>
                {enviando && <Loader2 className="animate-spin" />} Criar e entrar
              </Button>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
