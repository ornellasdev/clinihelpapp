import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Building2, ExternalLink, KeyRound, Loader2, LogOut, Plus, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { meQuery, type Me } from "@/lib/queries";
import { criarClinica, definirClinicaAtiva, listarClinicas } from "@/lib/dev.functions";
import { gerarSlug, slugValido } from "@/lib/clinica-slug";
import { erroAmigavel } from "@/lib/ui-helpers";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/dev")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Acesso desenvolvedor — CliniHelp" },
      { name: "description", content: "Área restrita da equipe CliniHelp para administrar as clínicas." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Acesso desenvolvedor — CliniHelp" },
      { property: "og:description", content: "Área restrita da equipe CliniHelp." },
    ],
  }),
  component: DevPage,
});

type Etapa = "carregando" | "entrar" | "negado" | "verificar" | "painel";

/** Erro devolvido pelo login Google na URL (fluxo com redirecionamento), já removido da barra de endereço. */
function lerErroDaUrl(): string | null {
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const busca = new URLSearchParams(window.location.search);
  const erro = hash.get("error_description") ?? hash.get("error") ?? busca.get("error_description") ?? busca.get("error");
  if (erro) window.history.replaceState(null, "", window.location.pathname);
  return erro;
}

function loginCancelado(msg: string) {
  return /cancel|closed|fechad/i.test(msg);
}

function DevPage() {
  const qc = useQueryClient();
  const [etapa, setEtapa] = useState<Etapa>("carregando");
  const [email, setEmail] = useState<string | null>(null);

  async function avaliar() {
    const erroUrl = lerErroDaUrl();
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) {
      if (erroUrl && !loginCancelado(erroUrl)) {
        setEmail(null);
        setEtapa("negado");
        return;
      }
      setEtapa("entrar");
      return;
    }
    setEmail(u.user.email ?? null);
    // staleTime 0 força dados novos sem descartar uma busca já em andamento (evita CancelledError).
    const me: Me = await qc.fetchQuery({ ...meQuery, staleTime: 0 });
    setEtapa(me.dev ? "painel" : me.dev_pendente ? "verificar" : "negado");
  }

  useEffect(() => {
    void avaliar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function sair() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    setEmail(null);
    setEtapa("entrar");
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between bg-sidebar px-6 py-4 text-sidebar-foreground">
        <div className="flex items-center gap-3">
          <Logo />
          <span className="rounded-full bg-sidebar-accent px-3 py-1 text-xs font-medium">Desenvolvedor</span>
        </div>
        {etapa !== "entrar" && etapa !== "carregando" && email && (
          <Button variant="ghost" size="sm" onClick={sair} className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground">
            <LogOut className="size-4" /> Sair
          </Button>
        )}
      </header>
      <main className="mx-auto max-w-5xl p-6">
        {etapa === "carregando" && <Loader2 className="mx-auto mt-24 size-6 animate-spin text-muted-foreground" />}
        {etapa === "entrar" && (
          <Entrar onNegado={() => { setEmail(null); setEtapa("negado"); }} />
        )}
        {etapa === "negado" && (
          <div role="alert" className="mx-auto mt-16 max-w-md rounded-2xl border border-destructive/40 bg-card p-8 shadow-sm">
            <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <ShieldX className="size-6" />
            </div>
            <h1 className="mt-4 text-xl font-semibold">Acesso negado</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {email ? <>A conta <strong className="text-foreground">{email}</strong></> : "Esta conta Google"} não possui
              autorização para acessar a área de desenvolvedor do CliniHelp.
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Se você trabalha em uma clínica, entre pela página de login da sua clínica.
            </p>
            <Button className="mt-6 w-full" variant="outline" onClick={sair}>Entrar com outra conta</Button>
          </div>
        )}
        {etapa === "verificar" && <Verificar onOk={avaliar} />}
        {etapa === "painel" && <PainelClinicas />}
      </main>
    </div>
  );
}

function Cartao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto mt-16 max-w-md rounded-2xl border bg-card p-8 shadow-sm">
      <h1 className="text-xl font-semibold">{titulo}</h1>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function Entrar({ onNegado }: { onNegado: () => void }) {
  const [enviando, setEnviando] = useState(false);
  async function google() {
    setEnviando(true);
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: `${window.location.origin}/dev` });
    if (r.error) {
      setEnviando(false);
      if (loginCancelado(r.error.message ?? "")) {
        toast.info("Login com o Google cancelado.");
        return;
      }
      onNegado();
      return;
    }
    if (r.redirected) return;
    window.location.reload();
  }
  return (
    <Cartao titulo="Acesso desenvolvedor">
      <p className="text-sm text-muted-foreground">
        Entre com a conta Google autorizada. Em seguida será pedido o código do aplicativo autenticador.
      </p>
      <Button className="mt-6 h-11 w-full" onClick={google} disabled={enviando}>
        {enviando && <Loader2 className="animate-spin" />} Entrar com Google
      </Button>
    </Cartao>
  );
}

/** Segunda etapa: código de 6 dígitos de um app autenticador (Google Authenticator, Authy etc.). */
function Verificar({ onOk }: { onOk: () => void }) {
  const [fator, setFator] = useState<{ id: string; qr?: string; secret?: string } | null>(null);
  const [codigo, setCodigo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) { setErro(error.message); return; }
      const verificado = data.totp.find((f) => f.status === "verified");
      if (verificado) { setFator({ id: verificado.id }); return; }
      for (const f of data.all.filter((f) => f.status !== "verified")) {
        await supabase.auth.mfa.unenroll({ factorId: f.id });
      }
      const en = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: `CliniHelp ${Date.now()}` });
      if (en.error) { setErro(en.error.message); return; }
      setFator({ id: en.data.id, qr: en.data.totp.qr_code, secret: en.data.totp.secret });
    })();
  }, []);

  async function confirmar(e: React.FormEvent) {
    e.preventDefault();
    if (!fator) return;
    setEnviando(true);
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: fator.id, code: codigo.trim() });
    setEnviando(false);
    if (error) { toast.error("Código inválido ou expirado. Tente o código atual do aplicativo."); setCodigo(""); return; }
    onOk();
  }

  return (
    <Cartao titulo="Verificação em duas etapas">
      {erro && <p className="text-sm text-destructive">{erroAmigavel(erro)}</p>}
      {!fator && !erro && <Loader2 className="mx-auto size-6 animate-spin text-muted-foreground" />}
      {fator && (
        <form onSubmit={confirmar} className="space-y-4">
          {fator.qr ? (
            <>
              <p className="text-sm text-muted-foreground">
                Primeiro acesso: leia o QR code com o Google Authenticator (ou outro autenticador) e digite o código gerado.
              </p>
              <div className="mx-auto w-48 rounded-xl bg-card p-2 ring-1 ring-border">
                <img src={fator.qr} alt="QR code para o aplicativo autenticador" className="w-full" />
              </div>
              <p className="break-all text-center font-mono text-xs text-muted-foreground">{fator.secret}</p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Digite o código de 6 dígitos do seu aplicativo autenticador.</p>
          )}
          <div className="space-y-2">
            <Label htmlFor="codigo">Código</Label>
            <Input
              id="codigo"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              autoFocus
              required
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))}
              className="text-center font-mono text-lg tracking-[0.5em]"
            />
          </div>
          <Button type="submit" className="h-11 w-full" disabled={enviando || codigo.length !== 6}>
            {enviando ? <Loader2 className="animate-spin" /> : <ShieldCheck />} Verificar
          </Button>
        </form>
      )}
    </Cartao>
  );
}

function PainelClinicas() {
  const navigate = useNavigate();
  const listar = useServerFn(listarClinicas);
  const alternar = useServerFn(definirClinicaAtiva);
  const { data: clinicas, isLoading, refetch } = useQuery({ queryKey: ["dev-clinicas"], queryFn: () => listar() });
  const [novaAberta, setNovaAberta] = useState(false);

  async function mudarAtiva(id: string, ativa: boolean) {
    try {
      await alternar({ data: { id, ativa } });
      toast.success(ativa ? "Clínica reativada" : "Acesso da clínica suspenso");
      refetch();
    } catch (e) {
      toast.error(erroAmigavel((e as Error).message));
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Clínicas</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Cada clínica tem endereço, equipe, pacientes, financeiro e auditoria próprios.
          </p>
        </div>
        <Button onClick={() => setNovaAberta(true)}>
          <Plus /> Nova clínica
        </Button>
      </div>

      {isLoading && <Loader2 className="mx-auto mt-16 size-6 animate-spin text-muted-foreground" />}
      {clinicas && clinicas.length === 0 && (
        <div className="mt-10 rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          Nenhuma clínica cadastrada ainda. Crie a primeira com o botão “Nova clínica”.
        </div>
      )}
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {clinicas?.map((c) => (
          <div key={c.id} className="rounded-2xl border bg-card p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                  <Building2 className="size-5" />
                </div>
                <div className="min-w-0">
                  <div className="truncate font-semibold">{c.nome}</div>
                  <div className="truncate font-mono text-xs text-muted-foreground">/{c.slug}</div>
                </div>
              </div>
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                {c.ativa ? "Ativa" : "Suspensa"}
                <Switch checked={c.ativa} onCheckedChange={(v) => mudarAtiva(c.id, v)} />
              </label>
            </div>
            <div className="mt-4 flex gap-6 text-sm">
              <div><span className="font-semibold">{c.equipe}</span> <span className="text-muted-foreground">na equipe</span></div>
              <div><span className="font-semibold">{c.pacientes}</span> <span className="text-muted-foreground">pacientes</span></div>
            </div>
            <Button
              variant="outline"
              className="mt-4 w-full"
              onClick={() => navigate({ to: "/$clinica/painel", params: { clinica: c.slug } })}
            >
              <ExternalLink /> Entrar nesta clínica
            </Button>
          </div>
        ))}
      </div>

      <NovaClinica aberta={novaAberta} onClose={() => setNovaAberta(false)} onCriada={() => refetch()} />
    </div>
  );
}

function NovaClinica({ aberta, onClose, onCriada }: { aberta: boolean; onClose: () => void; onCriada: () => void }) {
  const criar = useServerFn(criarClinica);
  const [nome, setNome] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEditado, setSlugEditado] = useState(false);
  const [masterNome, setMasterNome] = useState("");
  const [masterEmail, setMasterEmail] = useState("");
  const [masterSenha, setMasterSenha] = useState("");
  const [enviando, setEnviando] = useState(false);

  function limpar() {
    setNome(""); setSlug(""); setSlugEditado(false); setMasterNome(""); setMasterEmail(""); setMasterSenha("");
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!slugValido(slug)) { toast.error("Endereço inválido: use letras minúsculas, números e hífens (mín. 3)."); return; }
    setEnviando(true);
    try {
      await criar({ data: { nome, slug, masterNome, masterEmail, masterSenha } });
      toast.success(`Clínica criada! Endereço: /${slug}`);
      limpar();
      onCriada();
      onClose();
    } catch (err) {
      toast.error(erroAmigavel((err as Error).message));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Dialog open={aberta} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova clínica</DialogTitle>
          <DialogDescription>Cria a clínica e a conta master que vai cadastrar o restante da equipe.</DialogDescription>
        </DialogHeader>
        <form onSubmit={salvar} className="min-w-0 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="c-nome">Nome da clínica</Label>
            <Input
              id="c-nome"
              required
              value={nome}
              onChange={(e) => { setNome(e.target.value); if (!slugEditado) setSlug(gerarSlug(e.target.value)); }}
            />
          </div>
          <div className="min-w-0 space-y-2">
            <Label htmlFor="c-slug">Endereço</Label>
            <div className="flex min-w-0 items-center rounded-md border bg-background pl-3 text-sm text-muted-foreground focus-within:ring-2 focus-within:ring-ring">
              <span className="shrink-0">/</span>
              <input
                id="c-slug"
                required
                value={slug}
                placeholder="nome-da-clinica"
                onChange={(e) => { setSlugEditado(true); setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "")); }}
                className="h-10 w-full min-w-0 flex-1 bg-transparent pr-3 font-mono text-foreground outline-none placeholder:text-muted-foreground/60"
              />
            </div>
            <p className="break-all text-xs text-muted-foreground">
              Link da clínica: {typeof window !== "undefined" ? window.location.origin : ""}/{slug || "nome-da-clinica"}
            </p>
          </div>
          <div className="rounded-xl bg-muted/50 p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-medium"><KeyRound className="size-4" /> Conta master</div>
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="m-nome">Nome completo</Label>
                <Input id="m-nome" required value={masterNome} onChange={(e) => setMasterNome(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="m-email">E-mail</Label>
                <Input id="m-email" type="email" required value={masterEmail} onChange={(e) => setMasterEmail(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="m-senha">Senha inicial (mínimo 8 caracteres)</Label>
                <Input id="m-senha" type="text" minLength={8} required value={masterSenha} onChange={(e) => setMasterSenha(e.target.value)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={enviando}>
              {enviando && <Loader2 className="animate-spin" />} Criar clínica
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
