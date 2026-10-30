import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { erroAmigavel } from "@/lib/ui-helpers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Segunda etapa: código de 6 dígitos do Google Authenticator (ou outro autenticador).
 * Sem autenticador confirmado, mostra o QR code para cadastrar; com ele, pede só o código.
 */
export function VerificacaoDuasEtapas({ onOk }: { onOk: () => void | Promise<void> }) {
  const [fator, setFator] = useState<{ id: string; qr?: string; secret?: string } | null>(null);
  const [codigo, setCodigo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const iniciado = useRef(false);

  useEffect(() => {
    // Evita dois cadastros simultâneos (o segundo apagaria o QR code mostrado).
    if (iniciado.current) return;
    iniciado.current = true;
    (async () => {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) { setErro(error.message); return; }
      const verificado = data.totp.find((f) => f.status === "verified");
      if (verificado) { setFator({ id: verificado.id }); return; }
      for (const f of data.all.filter((f) => f.status !== "verified")) {
        await supabase.auth.mfa.unenroll({ factorId: f.id });
      }
      const en = await supabase.auth.mfa.enroll({ factorType: "totp", issuer: "CliniHelp", friendlyName: `CliniHelp ${Date.now()}` });
      if (en.error) { setErro(en.error.message); return; }
      setFator({ id: en.data.id, qr: en.data.totp.qr_code, secret: en.data.totp.secret });
    })();
  }, []);

  async function confirmar(e: React.FormEvent) {
    e.preventDefault();
    if (!fator) return;
    setEnviando(true);
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: fator.id, code: codigo.trim() });
    if (error) {
      setEnviando(false);
      toast.error("Código inválido ou expirado. Digite o código que aparece agora no aplicativo.");
      setCodigo("");
      return;
    }
    await onOk();
    setEnviando(false);
  }

  if (erro) return <p className="text-sm text-destructive">{erroAmigavel(erro)}</p>;
  if (!fator) return <Loader2 className="mx-auto size-6 animate-spin text-muted-foreground" />;

  return (
    <form onSubmit={confirmar} className="space-y-4">
      {fator.qr ? (
        <>
          <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
            <li>Instale o <strong className="text-foreground">Google Authenticator</strong> no celular (ou outro aplicativo autenticador).</li>
            <li>No aplicativo, toque em <strong className="text-foreground">+</strong> e leia o QR code abaixo.</li>
            <li>Digite o código de 6 dígitos que aparecer.</li>
          </ol>
          <div className="mx-auto w-48 rounded-xl bg-card p-2 ring-1 ring-border">
            <img src={fator.qr} alt="QR code para o aplicativo autenticador" className="w-full" />
          </div>
          <details className="text-center text-xs text-muted-foreground">
            <summary className="cursor-pointer">Não consegue ler o QR code? Digite esta chave no aplicativo</summary>
            <p className="mt-2 break-all font-mono">{fator.secret}</p>
          </details>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">Abra o Google Authenticator e digite o código de 6 dígitos do CliniHelp.</p>
      )}
      <div className="space-y-2">
        <Label htmlFor="codigo-2fa">Código</Label>
        <Input
          id="codigo-2fa"
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
  );
}
