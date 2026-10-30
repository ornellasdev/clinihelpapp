import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { meQuery } from "@/lib/queries";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { erroAmigavel } from "@/lib/ui-helpers";
import { Logo } from "@/components/Logo";
import { DefinirSenha } from "@/components/seguranca/DefinirSenha";
import { VerificacaoDuasEtapas } from "@/components/seguranca/VerificacaoDuasEtapas";
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

type Modo = "carregando" | "login" | "sem-clinica" | "senha" | "codigo" | "cadastro_2fa";

function AuthPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [modo, setModo] = useState<Modo>("carregando");
  const [primeiroAcesso, setPrimeiroAcesso] = useState(false);
  // Quem já confirmou o código nesta sessão está só trocando a senha (redefinição), não no primeiro acesso.
  const passouPeloCodigo = useRef(false);
  // Senha temporária digitada no login, só em memória: confirma a troca sem encerrar a sessão.
  const senhaDigitada = useRef<string | undefined>(undefined);
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [enviando, setEnviando] = useState(false);

  /** Leva cada pessoa para o endereço da própria clínica (ou para a área do desenvolvedor), depois das etapas de segurança. */
  async function irParaClinica(): Promise<boolean> {
    // staleTime 0 força dados novos sem descartar uma busca já em andamento (evita CancelledError).
    const me = await qc.fetchQuery({ ...meQuery, staleTime: 0 });
    if (me.dev || me.dev_pendente) {
      navigate({ to: "/dev", replace: true });
      return true;
    }
    if (me.pendencia) {
      if (me.pendencia === "codigo") passouPeloCodigo.current = true;
      if (me.pendencia === "senha") setPrimeiroAcesso(!passouPeloCodigo.current);
      setModo(me.pendencia);
      return false;
    }
    if (me.clinica) {
      navigate({ to: "/$clinica/painel", params: { clinica: me.clinica.slug }, replace: true });
      return true;
    }
    setModo("sem-clinica");
    return false;
  }

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (data.user) await irParaClinica().catch(() => setModo("login"));
      else setModo("login");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
    if (error) { setEnviando(false); toast.error(erroAmigavel(error.message)); return; }
    senhaDigitada.current = senha;
    setSenha("");
    await irParaClinica().catch((err) => toast.error(erroAmigavel((err as Error).message)));
    setEnviando(false);
  }

  /** Código do autenticador confirmado: a sessão passa a ser segura e o login conta na auditoria. */
  async function verificado() {
    await supabase.rpc("registrar_acesso", { _acao: "login" });
    await irParaClinica();
  }

  async function sair() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    setPrimeiroAcesso(false);
    passouPeloCodigo.current = false;
    senhaDigitada.current = undefined;
    setModo("login");
  }

  const etapa = (n: number, titulo: string, texto: string, conteudo: React.ReactNode) => (
    <div className="space-y-5">
      <div>
        {primeiroAcesso && <p className="text-xs font-medium uppercase tracking-wide text-primary">Primeiro acesso · etapa {n} de 2</p>}
        <h2 className="mt-1 text-2xl font-semibold">{titulo}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{texto}</p>
      </div>
      {conteudo}
      <Button variant="ghost" className="w-full text-muted-foreground" onClick={sair}>
        Sair e entrar com outra conta
      </Button>
    </div>
  );

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
              <Button asChild variant="outline" className="h-11 w-full">
                <Link to="/familia">Sou pai, mãe ou responsável</Link>
              </Button>
              <p className="text-center text-xs">
                <Link to="/dev" className="text-muted-foreground/70 hover:text-foreground">Acesso desenvolvedor</Link>
              </p>
            </form>
          )}

          {modo === "sem-clinica" && (
            <div className="space-y-4 text-center">
              <h2 className="text-xl font-semibold">Conta sem clínica</h2>
              <p className="text-sm text-muted-foreground">Esta conta não está ligada a nenhuma clínica. Se você é responsável por uma criança, use a Área da família.</p>
              <div className="flex justify-center gap-2">
                <Button asChild><Link to="/familia">Área da família</Link></Button>
                <Button variant="outline" onClick={sair}>Sair</Button>
              </div>
            </div>
          )}

          {modo === "senha" &&
            etapa(
              1,
              "Crie sua senha",
              "Por segurança, troque a senha temporária que você recebeu por uma senha só sua.",
              <DefinirSenha senhaAtual={senhaDigitada.current} onOk={async () => { senhaDigitada.current = undefined; await irParaClinica(); }} />,
            )}

          {modo === "cadastro_2fa" &&
            etapa(
              2,
              "Ative a verificação em duas etapas",
              "Obrigatória para todos da equipe. Depois, a cada login, será pedido o código do aplicativo.",
              <VerificacaoDuasEtapas onOk={verificado} />,
            )}

          {modo === "codigo" && (
            <div className="space-y-5">
              <div>
                <h2 className="text-2xl font-semibold">Verificação em duas etapas</h2>
                <p className="mt-1 text-sm text-muted-foreground">Perdeu ou trocou de celular? Peça ao master para redefinir a sua verificação.</p>
              </div>
              <VerificacaoDuasEtapas onOk={verificado} />
              <Button variant="ghost" className="w-full text-muted-foreground" onClick={sair}>
                Sair e entrar com outra conta
              </Button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
