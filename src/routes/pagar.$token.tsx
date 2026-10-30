import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Barcode, CheckCircle2, Copy, CreditCard, FileDown, Loader2, Lock, QrCode, XCircle } from "lucide-react";
import { obterPagamento, pagarComCartao, type PagamentoPublico } from "@/lib/pagamento-publico.functions";
import { STATUS_COBRANCA, somenteDigitos } from "@/lib/cobrancas";
import { formatarMoeda } from "@/lib/financeiro";
import { buscarCep } from "@/lib/cep";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const pagamentoQuery = (token: string) =>
  queryOptions({
    queryKey: ["pagamento-publico", token],
    queryFn: () => obterPagamento({ data: { token } }),
    refetchInterval: (q) => (q.state.data && (q.state.data.status === "pendente" || q.state.data.status === "vencido") ? 15_000 : false),
  });

export const Route = createFileRoute("/pagar/$token")({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(pagamentoQuery(params.token)).catch(() => null),
  head: () => ({
    meta: [
      { title: "Pagamento — CliniHelp" },
      { name: "description", content: "Pague a cobrança da clínica por Pix, boleto ou cartão de crédito." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Pagamento — CliniHelp" },
      { property: "og:description", content: "Pague a cobrança da clínica por Pix, boleto ou cartão de crédito." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PagarPage,
  errorComponent: () => (
    <Moldura>
      <Aviso icone={<XCircle className="size-10 text-destructive" />} titulo="Não foi possível abrir a cobrança" texto="Tente novamente em instantes." />
    </Moldura>
  ),
});

function Moldura({ children, clinica }: { children: React.ReactNode; clinica?: string }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="bg-sidebar px-4 py-4 text-sidebar-foreground">
        <div className="mx-auto flex max-w-xl items-center justify-between gap-3">
          <Logo />
          {clinica && <div className="truncate text-right text-sm font-medium">{clinica}</div>}
        </div>
      </header>
      <main className="mx-auto max-w-xl px-4 py-6">{children}</main>
      <footer className="flex items-center justify-center gap-1.5 pb-8 text-xs text-muted-foreground">
        <Lock className="size-3" /> Pagamento seguro · CliniHelp
      </footer>
    </div>
  );
}

function Aviso({ icone, titulo, texto }: { icone: React.ReactNode; titulo: string; texto: string }) {
  return (
    <div className="rounded-2xl border bg-card p-8 text-center">
      <div className="flex justify-center">{icone}</div>
      <h1 className="mt-4 text-xl font-semibold">{titulo}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{texto}</p>
    </div>
  );
}

function PagarPage() {
  const { token } = Route.useParams();
  const { data: p } = useSuspenseQuery(pagamentoQuery(token));

  if (!p) {
    return (
      <Moldura>
        <Aviso icone={<XCircle className="size-10 text-muted-foreground" />} titulo="Cobrança não encontrada" texto="Confira o link recebido ou fale com a clínica." />
      </Moldura>
    );
  }

  const venc = new Date(`${p.vencimento}T12:00:00`).toLocaleDateString("pt-BR");
  return (
    <Moldura clinica={p.clinica}>
      <div className="rounded-2xl border bg-card p-5 shadow-sm">
        <div className="text-xs text-muted-foreground">Cobrança para {p.pagador}</div>
        <div className="mt-1 font-medium">{p.descricao}</div>
        <div className="mt-4 flex items-end justify-between gap-3">
          <div>
            <div className="text-xs text-muted-foreground">Valor</div>
            <div className="font-display text-3xl font-bold">{formatarMoeda(p.valor)}</div>
          </div>
          <div className="text-right">
            <div className="text-xs text-muted-foreground">Vencimento</div>
            <div className="font-medium">{venc}</div>
            <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COBRANCA[p.status].className}`}>
              {STATUS_COBRANCA[p.status].label}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-5">
        {p.status === "pago" ? (
          <Aviso
            icone={<CheckCircle2 className="size-12 text-success" />}
            titulo="Pagamento confirmado"
            texto={`Obrigado! ${p.clinica} já recebeu a confirmação${p.pagoEm ? ` em ${new Date(p.pagoEm).toLocaleDateString("pt-BR")}` : ""}.`}
          />
        ) : p.status === "em_analise" ? (
          <Aviso icone={<Loader2 className="size-10 animate-spin text-muted-foreground" />} titulo="Pagamento em análise" texto="O pagamento com cartão está sendo analisado. Esta página se atualiza sozinha." />
        ) : p.status === "pendente" || p.status === "vencido" ? (
          <Opcoes p={p} token={token} />
        ) : (
          <Aviso icone={<XCircle className="size-10 text-muted-foreground" />} titulo={`Cobrança ${STATUS_COBRANCA[p.status].label.toLowerCase()}`} texto="Esta cobrança não está mais disponível para pagamento. Fale com a clínica." />
        )}
      </div>
    </Moldura>
  );
}

function Opcoes({ p, token }: { p: PagamentoPublico; token: string }) {
  const abas = [p.pix && "pix", p.boleto && "boleto", p.cartao && "cartao"].filter(Boolean) as string[];
  if (abas.length === 0) {
    return <Aviso icone={<Loader2 className="size-10 animate-spin text-muted-foreground" />} titulo="Preparando o pagamento" texto="Aguarde alguns instantes e recarregue a página." />;
  }
  return (
    <Tabs defaultValue={abas[0]}>
      {abas.length > 1 && (
        <TabsList className="grid w-full" style={{ gridTemplateColumns: `repeat(${abas.length}, minmax(0, 1fr))` }}>
          {p.pix && <TabsTrigger value="pix"><QrCode /> Pix</TabsTrigger>}
          {p.boleto && <TabsTrigger value="boleto"><Barcode /> Boleto</TabsTrigger>}
          {p.cartao && <TabsTrigger value="cartao"><CreditCard /> Cartão</TabsTrigger>}
        </TabsList>
      )}
      {p.pix && (
        <TabsContent value="pix">
          <div className="rounded-2xl border bg-card p-5 text-center">
            <p className="text-sm text-muted-foreground">Abra o app do seu banco, escolha Pix e leia o QR code ou use o “copia e cola”.</p>
            <img src={`data:image/png;base64,${p.pix.imagem}`} alt="QR code Pix" className="mx-auto mt-4 size-56 rounded-xl border bg-background p-2" />
            <Copiavel valor={p.pix.copiaECola} rotulo="Copiar código Pix" />
            <p className="mt-3 text-xs text-muted-foreground">A confirmação aparece aqui em poucos segundos após o pagamento.</p>
          </div>
        </TabsContent>
      )}
      {p.boleto && (
        <TabsContent value="boleto">
          <div className="rounded-2xl border bg-card p-5">
            <p className="text-sm text-muted-foreground">Pague no app do banco com a linha digitável. A compensação leva até 3 dias úteis.</p>
            <div className="mt-3 break-all rounded-xl bg-muted p-3 font-mono text-sm">{p.boleto.linhaDigitavel}</div>
            <Copiavel valor={p.boleto.linhaDigitavel.replace(/\D/g, "")} rotulo="Copiar linha digitável" />
            {p.boleto.pdf && (
              <Button asChild variant="outline" className="mt-2 w-full">
                <a href={p.boleto.pdf} target="_blank" rel="noopener noreferrer"><FileDown /> Baixar boleto (PDF)</a>
              </Button>
            )}
          </div>
        </TabsContent>
      )}
      {p.cartao && (
        <TabsContent value="cartao">
          <FormCartao token={token} pagador={p.pagador} />
        </TabsContent>
      )}
    </Tabs>
  );
}

function Copiavel({ valor, rotulo }: { valor: string; rotulo: string }) {
  return (
    <Button
      className="mt-4 w-full"
      onClick={() => navigator.clipboard.writeText(valor).then(() => toast.success("Copiado!"), () => toast.error("Não foi possível copiar"))}
    >
      <Copy /> {rotulo}
    </Button>
  );
}

function FormCartao({ token, pagador }: { token: string; pagador: string }) {
  const pagar = useServerFn(pagarComCartao);
  const qc = useQueryClient();
  const [f, setF] = useState({ numero: "", nomeCartao: "", validade: "", cvv: "", nome: pagador, cpf: "", email: "", telefone: "", cep: "", numeroCasa: "" });
  const [enviando, setEnviando] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF((s) => ({ ...s, [k]: e.target.value }));

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    const [mes, ano2] = f.validade.split("/");
    const ano = ano2 && ano2.length === 2 ? `20${ano2}` : (ano2 ?? "");
    setEnviando(true);
    try {
      const r = await pagar({
        data: {
          token,
          cartao: { nome: f.nomeCartao, numero: somenteDigitos(f.numero), mes: (mes ?? "").padStart(2, "0"), ano, cvv: somenteDigitos(f.cvv) },
          titular: {
            nome: f.nome,
            email: f.email,
            cpf: somenteDigitos(f.cpf),
            cep: somenteDigitos(f.cep),
            numero: f.numeroCasa,
            telefone: somenteDigitos(f.telefone),
          },
        },
      });
      toast[r.status === "pago" ? "success" : "info"](r.status === "pago" ? "Pagamento aprovado!" : "Pagamento enviado para análise.");
      setF((s) => ({ ...s, numero: "", cvv: "" }));
      qc.invalidateQueries({ queryKey: ["pagamento-publico", token] });
    } catch (err) {
      const msg = (err as Error).message;
      toast.error(msg.includes("Invalid") || msg.includes("validation") ? "Confira os dados do cartão e do titular." : msg);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={enviar} className="space-y-4 rounded-2xl border bg-card p-5" autoComplete="on">
      <div className="space-y-2">
        <Label htmlFor="cc-num">Número do cartão</Label>
        <Input id="cc-num" inputMode="numeric" autoComplete="cc-number" required value={f.numero} onChange={set("numero")} placeholder="0000 0000 0000 0000" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="cc-nome">Nome impresso no cartão</Label>
        <Input id="cc-nome" autoComplete="cc-name" required value={f.nomeCartao} onChange={set("nomeCartao")} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="cc-val">Validade (MM/AA)</Label>
          <Input id="cc-val" autoComplete="cc-exp" required placeholder="08/29" value={f.validade} onChange={set("validade")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cc-cvv">CVV</Label>
          <Input id="cc-cvv" inputMode="numeric" autoComplete="cc-csc" required maxLength={4} value={f.cvv} onChange={set("cvv")} />
        </div>
      </div>
      <div className="border-t pt-4 text-sm font-medium">Dados do titular do cartão</div>
      <div className="space-y-2">
        <Label htmlFor="t-nome">Nome completo</Label>
        <Input id="t-nome" autoComplete="name" required value={f.nome} onChange={set("nome")} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="t-cpf">CPF</Label>
          <Input id="t-cpf" inputMode="numeric" required value={f.cpf} onChange={set("cpf")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="t-tel">Celular com DDD</Label>
          <Input id="t-tel" inputMode="tel" autoComplete="tel" required value={f.telefone} onChange={set("telefone")} />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="t-email">E-mail</Label>
        <Input id="t-email" type="email" autoComplete="email" required value={f.email} onChange={set("email")} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="t-cep">CEP</Label>
          <Input id="t-cep" inputMode="numeric" autoComplete="postal-code" required value={f.cep} onChange={set("cep")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="t-numcasa">Número da casa</Label>
          <Input id="t-numcasa" required value={f.numeroCasa} onChange={set("numeroCasa")} />
        </div>
      </div>
      <Button type="submit" className="w-full" disabled={enviando}>
        {enviando ? <Loader2 className="animate-spin" /> : <Lock />} Pagar com cartão
      </Button>
      <p className="text-center text-xs text-muted-foreground">Os dados do cartão são enviados com segurança e não ficam guardados no CliniHelp.</p>
    </form>
  );
}
