import { configRepasseSchema, salvarConfigRepasse } from "@/services/financeiro";
import { mensagemDeErro } from "@/services/resultado";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Copy, KeyRound, Loader2, Pencil, Plus, Smartphone, UserCheck, UserX } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { configFinanceiraQuery, equipeQuery, especialidadesQuery, meQuery, type Membro } from "@/lib/queries";
import { criarMembro, definirAtivo, redefinirDuasEtapas, redefinirSenha } from "@/lib/equipe.functions";
import { MSG_SENHA_FRACA, gerarSenhaTemporaria, senhaForte } from "@/lib/senha";
import { RequisitosSenha } from "@/components/seguranca/RequisitosSenha";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { PAPEIS, ehGestor, papeisAtribuiveis, podeAlterarMembro, type Papel } from "@/lib/permissions";
import { useMe } from "@/hooks/use-me";
import { corEsp, erroAmigavel, iniciais } from "@/lib/ui-helpers";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/$clinica/equipe")({
  beforeLoad: async ({ context, params }) => {
    const me = await context.queryClient.ensureQueryData(meQuery);
    if (!ehGestor(me.papeis)) throw redirect({ to: "/$clinica/painel", params });
  },
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(equipeQuery),
      context.queryClient.ensureQueryData(especialidadesQuery),
      context.queryClient.ensureQueryData(configFinanceiraQuery),
    ]),
  head: () => ({ meta: [{ title: "Equipe — CliniHelp" }] }),
  component: EquipePage,
});

function EquipePage() {
  const me = useMe();
  const { data: equipe } = useSuspenseQuery(equipeQuery);
  const { data: especialidades } = useSuspenseQuery(especialidadesQuery);
  const { data: configs } = useSuspenseQuery(configFinanceiraQuery);
  const qc = useQueryClient();
  const ativar = useServerFn(definirAtivo);
  const doisFatoresFn = useServerFn(redefinirDuasEtapas);
  const [editando, setEditando] = useState<Membro | "novo" | null>(null);
  const [senhaPara, setSenhaPara] = useState<Membro | null>(null);
  const [doisFatoresPara, setDoisFatoresPara] = useState<Membro | null>(null);

  async function alternarAtivo(m: Membro) {
    try {
      await ativar({ data: { userId: m.id, ativo: !m.ativo } });
      toast.success(m.ativo ? "Acesso desativado." : "Acesso reativado.");
      qc.invalidateQueries({ queryKey: ["equipe"] });
    } catch (e) {
      toast.error(erroAmigavel((e as Error).message));
    }
  }

  async function apagarDoisFatores() {
    const m = doisFatoresPara;
    setDoisFatoresPara(null);
    if (!m) return;
    try {
      await doisFatoresFn({ data: { userId: m.id } });
      toast.success(`Verificação em duas etapas de ${m.nome} redefinida. No próximo login a pessoa cadastra o celular de novo.`);
    } catch (e) {
      toast.error(erroAmigavel((e as Error).message));
    }
  }

  return (
    <div>
      <PageHeader
        titulo="Equipe e acessos"
        descricao="Cada pessoa vê apenas o que o seu papel permite. Prontuários ficam restritos à especialidade."
        acoes={
          <Button onClick={() => setEditando("novo")}>
            <Plus /> Novo membro
          </Button>
        }
      />

      <div className="mb-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {PAPEIS.map((p) => (
          <div key={p.value} className="rounded-xl border bg-surface p-3">
            <div className="text-sm font-semibold">{p.label}</div>
            <div className="text-xs text-muted-foreground">{p.descricao}</div>
          </div>
        ))}
      </div>

      <div className="divide-y rounded-2xl border bg-card">
        {equipe.map((m) => {
          const conf = configs.find((c) => c.user_id === m.id);
          return (
            <div key={m.id} className={cn("flex flex-wrap items-center gap-3 p-4", !m.ativo && "opacity-60")}>
              <div className="flex size-10 items-center justify-center rounded-full bg-secondary font-semibold text-secondary-foreground">
                {iniciais(m.nome)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{m.nome}</span>
                  {!m.ativo && <span className="rounded bg-destructive/10 px-1.5 text-[10px] uppercase text-destructive">inativo</span>}
                  {m.ativo && m.senha_temporaria && (
                    <span className="rounded bg-warning/20 px-1.5 text-[10px] uppercase text-foreground">senha temporária</span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  {m.email}
                  {(m.conselho || m.registro_profissional) && ` · ${[m.conselho, m.registro_profissional].filter(Boolean).join(" ")}`}
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {m.papeis.map((p) => (
                    <span key={p} className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium">
                      {PAPEIS.find((x) => x.value === p)?.label}
                    </span>
                  ))}
                  {m.especialidades.map((id) => {
                    const e = especialidades.find((x) => x.id === id);
                    return (
                      <span key={id} className={cn("rounded-full border px-2 py-0.5 text-[11px]", corEsp(e?.cor))}>
                        {e?.nome}
                      </span>
                    );
                  })}
                </div>
              </div>
              {m.papeis.includes("profissional") && conf && (
                <div className="text-right text-xs text-muted-foreground">
                  Repasse de profissional <span className="font-semibold text-foreground">{Number(conf.percentual_repasse_padrao)}%</span>
                </div>
              )}
              {podeAlterarMembro(me.papeis, m.papeis) ? (
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" onClick={() => setEditando(m)} aria-label="Editar">
                  <Pencil />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => setSenhaPara(m)} aria-label="Criar senha temporária" title="Criar senha temporária">
                  <KeyRound />
                </Button>
                {m.id !== me.id && (
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setDoisFatoresPara(m)}
                    aria-label="Redefinir verificação em duas etapas"
                    title="Redefinir verificação em duas etapas (celular perdido ou trocado)"
                  >
                    <Smartphone />
                  </Button>
                )}
                <Button size="icon" variant="ghost" onClick={() => alternarAtivo(m)} aria-label={m.ativo ? "Desativar" : "Reativar"}>
                  {m.ativo ? <UserX /> : <UserCheck />}
                </Button>
              </div>
              ) : (
                <span className="text-xs text-muted-foreground">Só o master altera</span>
              )}
            </div>
          );
        })}
      </div>

      {editando && (
        <MembroDialog
          membro={editando === "novo" ? undefined : editando}
          config={editando === "novo" ? undefined : configs.find((c) => c.user_id === editando.id)}
          onClose={() => setEditando(null)}
        />
      )}
      {senhaPara && <SenhaTemporariaDialog membro={senhaPara} onClose={() => setSenhaPara(null)} />}

      <AlertDialog open={!!doisFatoresPara} onOpenChange={(v) => !v && setDoisFatoresPara(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Redefinir a verificação em duas etapas de {doisFatoresPara?.nome}?</AlertDialogTitle>
            <AlertDialogDescription>
              Use quando a pessoa perdeu ou trocou de celular. O código atual deixa de valer e, no próximo login, ela lê um novo QR code no
              Google Authenticator.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={apagarDoisFatores}>Redefinir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function copiarTexto(texto: string) {
  navigator.clipboard.writeText(texto).then(
    () => toast.success("Copiado"),
    () => toast.error("Não foi possível copiar"),
  );
}

/** Campo de senha temporária com botão de gerar, copiar e a lista de regras. */
function CampoSenhaTemporaria({ id, valor, onChange }: { id: string; valor: string; onChange: (v: string) => void }) {
  return (
    <div className="grid gap-1.5">
      <div className="flex gap-2">
        <Input id={id} type="text" value={valor} onChange={(e) => onChange(e.target.value)} className="font-mono" autoComplete="off" />
        <Button type="button" variant="outline" onClick={() => onChange(gerarSenhaTemporaria())}>
          Gerar
        </Button>
        <Button type="button" variant="ghost" size="icon" disabled={!valor} onClick={() => copiarTexto(valor)} aria-label="Copiar senha">
          <Copy />
        </Button>
      </div>
      <RequisitosSenha senha={valor} />
    </div>
  );
}

function SenhaTemporariaDialog({ membro, onClose }: { membro: Membro; onClose: () => void }) {
  const qc = useQueryClient();
  const senhaFn = useServerFn(redefinirSenha);
  const [senha, setSenha] = useState(() => gerarSenhaTemporaria());
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    if (!senhaForte(senha)) { toast.error(MSG_SENHA_FRACA); return; }
    setSalvando(true);
    try {
      await senhaFn({ data: { userId: membro.id, password: senha } });
      toast.success("Senha temporária criada. Envie para a pessoa: no próximo login ela cria a própria senha.");
      qc.invalidateQueries({ queryKey: ["equipe"] });
      onClose();
    } catch (e) {
      toast.error(mensagemDeErro(e));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Senha temporária para {membro.nome}</DialogTitle>
          <DialogDescription>
            A senha atual deixa de funcionar. No próximo login, {membro.nome.split(" ")[0]} entra com esta senha e é obrigado(a) a criar uma nova.
          </DialogDescription>
        </DialogHeader>
        <CampoSenhaTemporaria id="senha-temp" valor={senha} onChange={setSenha} />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={salvar} disabled={salvando || !senhaForte(senha)}>
            {salvando && <Loader2 className="animate-spin" />} Salvar senha temporária
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MembroDialog({
  membro,
  config,
  onClose,
}: {
  membro?: Membro | undefined;
  config?: { valor_sessao_padrao: number; percentual_repasse_padrao: number } | undefined;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const me = useMe();
  const { data: especialidades } = useSuspenseQuery(especialidadesQuery);
  const opcoesPapel = PAPEIS.filter((p) => papeisAtribuiveis(me.papeis).includes(p.value));
  // Administrador não vincula especialidades a si mesmo (isso abriria os prontuários).
  const travarEspecialidades = !!membro && membro.id === me.id && !me.papeis.includes("master");
  const criar = useServerFn(criarMembro);
  const [nome, setNome] = useState(membro?.nome ?? "");
  const [email, setEmail] = useState(membro?.email ?? "");
  const [senha, setSenha] = useState(() => (membro ? "" : gerarSenhaTemporaria()));
  const [telefone, setTelefone] = useState(membro?.telefone ?? "");
  const [conselho, setConselho] = useState(membro?.conselho ?? "");
  const [registro, setRegistro] = useState(membro?.registro_profissional ?? "");
  const [papeis, setPapeis] = useState<Papel[]>(membro?.papeis ?? ["profissional"]);
  const [esps, setEsps] = useState<string[]>(membro?.especialidades ?? []);
  const [valor, setValor] = useState(String(config?.valor_sessao_padrao ?? 0));
  const [pct, setPct] = useState(String(config?.percentual_repasse_padrao ?? 50));
  const [salvando, setSalvando] = useState(false);

  const toggle = <T,>(lista: T[], v: T) => (lista.includes(v) ? lista.filter((x) => x !== v) : [...lista, v]);
  const isProf = papeis.includes("profissional");

  async function salvar() {
    if (!nome.trim() || papeis.length === 0) { toast.error("Informe o nome e ao menos um papel."); return; }
    if (isProf && esps.length === 0) { toast.error("Profissionais precisam de ao menos uma especialidade."); return; }
    if (!membro && !senhaForte(senha)) { toast.error(MSG_SENHA_FRACA); return; }
    const repasse = configRepasseSchema.safeParse({ valor_sessao_padrao: valor || "0", percentual_repasse_padrao: isProf ? pct : pct || "0" });
    if (!repasse.success) { toast.error(repasse.error.issues[0]?.message ?? "Repasse inválido."); return; }
    const { valor_sessao_padrao, percentual_repasse_padrao } = repasse.data;
    setSalvando(true);
    try {
      if (!membro) {
        await criar({
          data: {
            nome,
            email,
            password: senha,
            telefone,
            conselho,
            registro,
            papeis,
            especialidades: isProf ? esps : [],
            valorPadrao: valor_sessao_padrao,
            percentualPadrao: percentual_repasse_padrao,
          },
        });
      } else {
        const id = membro.id;
        const up = await supabase
          .from("profiles")
          .update({ nome, telefone: telefone || null, conselho: conselho || null, registro_profissional: registro || null })
          .eq("id", id);
        if (up.error) throw up.error;
        const addP = papeis.filter((p) => !membro.papeis.includes(p));
        const remP = membro.papeis.filter((p) => !papeis.includes(p));
        if (addP.length) {
          const r = await supabase.from("user_roles").insert(addP.map((role) => ({ user_id: id, role })));
          if (r.error) throw r.error;
        }
        if (remP.length) await supabase.from("user_roles").delete().eq("user_id", id).in("role", remP);
        const alvo = isProf ? esps : [];
        const addE = alvo.filter((e) => !membro.especialidades.includes(e));
        const remE = membro.especialidades.filter((e) => !alvo.includes(e));
        if (addE.length && !travarEspecialidades) await supabase.from("profissional_especialidades").insert(addE.map((especialidade_id) => ({ user_id: id, especialidade_id })));
        if (remE.length && !travarEspecialidades) await supabase.from("profissional_especialidades").delete().eq("user_id", id).in("especialidade_id", remE);
        await salvarConfigRepasse(id, { valor_sessao_padrao, percentual_repasse_padrao });
      }
      toast.success(membro ? "Dados atualizados." : "Membro criado. Envie o e-mail e a senha temporária: no primeiro login a pessoa cria a própria senha e ativa a verificação em duas etapas.");
      qc.invalidateQueries({ queryKey: ["equipe"] });
      qc.invalidateQueries({ queryKey: ["profissional_config"] });
      qc.invalidateQueries({ queryKey: ["me"] });
      onClose();
    } catch (e) {
      toast.error(erroAmigavel((e as Error).message));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{membro ? `Editar ${membro.nome}` : "Novo membro da equipe"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5 sm:col-span-2">
              <Label>Nome completo</Label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} />
            </div>
            {!membro && (
              <>
                <div className="grid gap-1.5">
                  <Label>E-mail de acesso</Label>
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div className="grid gap-1.5 sm:col-span-2">
                  <Label htmlFor="senha-nova-conta">Senha temporária</Label>
                  <CampoSenhaTemporaria id="senha-nova-conta" valor={senha} onChange={setSenha} />
                </div>
              </>
            )}
            <div className="grid gap-1.5">
              <Label>Telefone</Label>
              <Input value={telefone} onChange={(e) => setTelefone(e.target.value)} />
            </div>
          </div>

          <div>
            <Label>Papéis de acesso</Label>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {opcoesPapel.map((p) => (
                <label key={p.value} className="flex cursor-pointer items-start gap-2 rounded-lg border p-2.5">
                  <Checkbox checked={papeis.includes(p.value)} onCheckedChange={() => setPapeis((x) => toggle(x, p.value))} className="mt-0.5" />
                  <span>
                    <span className="block text-sm font-medium">{p.label}</span>
                    <span className="block text-xs text-muted-foreground">{p.descricao}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          {isProf && (
            <>
              <div>
                <Label>Especialidades (define quais prontuários a pessoa vê)</Label>
                {travarEspecialidades && (
                  <p className="mt-1 text-xs text-muted-foreground">Suas especialidades só podem ser alteradas pelo master.</p>
                )}
                <div className="mt-2 flex flex-wrap gap-2">
                  {especialidades.map((e) => (
                    <button
                      type="button"
                      key={e.id}
                      disabled={travarEspecialidades}
                      onClick={() => setEsps((x) => toggle(x, e.id))}
                      className={cn("rounded-full border px-3 py-1 text-sm transition", esps.includes(e.id) ? corEsp(e.cor) : "text-muted-foreground")}
                    >
                      {e.nome}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label>Conselho</Label>
                  <Input value={conselho} onChange={(e) => setConselho(e.target.value)} placeholder="CRP, CRFa, CREFITO..." />
                </div>
                <div className="grid gap-1.5">
                  <Label>Nº do registro</Label>
                  <Input value={registro} onChange={(e) => setRegistro(e.target.value)} placeholder="06/123456" />
                </div>
                <div className="grid gap-1.5">
                  <Label>Repasse de profissional (%)</Label>
                  <Input inputMode="decimal" value={pct} onChange={(e) => setPct(e.target.value)} placeholder="Ex.: 50" />
                  <p className="text-xs text-muted-foreground">De 0 a 100%. Pode ser ajustado em cada sessão no Financeiro.</p>
                </div>
              </div>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={salvar} disabled={salvando}>
            {salvando && <Loader2 className="animate-spin" />} {membro ? "Salvar" : "Criar acesso"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
