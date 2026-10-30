import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { definirMinhaSenha } from "@/lib/seguranca.functions";
import { MSG_SENHA_FRACA, SENHA_MAX, senhaForte } from "@/lib/senha";
import { erroAmigavel } from "@/lib/ui-helpers";
import { RequisitosSenha } from "./RequisitosSenha";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Troca da senha temporária (criada pelo master) por uma senha da própria pessoa. */
export function DefinirSenha({ onOk, senhaAtual }: { onOk: () => void | Promise<void>; senhaAtual?: string }) {
  const salvar = useServerFn(definirMinhaSenha);
  const [senha, setSenha] = useState("");
  const [confirma, setConfirma] = useState("");
  const [ver, setVer] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const iguais = senha === confirma;

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!senhaForte(senha)) { toast.error(MSG_SENHA_FRACA); return; }
    if (!iguais) { toast.error("As duas senhas não são iguais."); return; }
    setEnviando(true);
    try {
      const { data: sessao } = await supabase.auth.getSession();
      const email = sessao.session?.user.email;
      const r = await salvar({ data: { senha, atual: senhaAtual } });
      if (r.relogin && email) {
        const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
        if (error) throw error;
      }
      toast.success("Senha criada.");
      await onOk();
    } catch (err) {
      toast.error(erroAmigavel((err as Error).message));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={enviar} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="nova-senha">Nova senha</Label>
        <div className="relative">
          <Input
            id="nova-senha"
            type={ver ? "text" : "password"}
            autoComplete="new-password"
            autoFocus
            required
            maxLength={SENHA_MAX}
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            className="pr-10"
          />
          <button
            type="button"
            onClick={() => setVer((v) => !v)}
            className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground hover:text-foreground"
            aria-label={ver ? "Esconder senha" : "Mostrar senha"}
          >
            {ver ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
        <RequisitosSenha senha={senha} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirma-senha">Repita a nova senha</Label>
        <Input
          id="confirma-senha"
          type={ver ? "text" : "password"}
          autoComplete="new-password"
          required
          maxLength={SENHA_MAX}
          value={confirma}
          onChange={(e) => setConfirma(e.target.value)}
          aria-invalid={!!confirma && !iguais}
        />
        {confirma && !iguais && <p className="text-xs text-destructive">As senhas não são iguais.</p>}
      </div>
      <Button type="submit" className="h-11 w-full" disabled={enviando || !senhaForte(senha) || !iguais}>
        {enviando && <Loader2 className="animate-spin" />} Salvar minha senha
      </Button>
    </form>
  );
}
