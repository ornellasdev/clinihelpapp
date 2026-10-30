import { useState } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { convenioValoresQuery, conveniosQuery } from "@/lib/queries";
import { TIPOS_CONVENIO, type TipoConvenio } from "@/lib/convenios";
import { lerValorReais, valorParaCampo } from "@/lib/validacao";
import { useConvenios } from "@/hooks/use-financeiro";
import { ErroServico, mensagemDeErro } from "@/services/resultado";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

export function TabelaConvenios() {
  const acoes = useConvenios();
  const { data: convenios } = useSuspenseQuery(conveniosQuery);
  const { data: valores } = useSuspenseQuery(convenioValoresQuery);
  const valorDe = (id: string) => Number(valores.find((v) => v.convenio_id === id)?.valor_sessao ?? 0);

  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState<TipoConvenio>("convenio");
  const [valor, setValor] = useState("");
  const [erros, setErros] = useState<Record<string, string>>({});
  const salvando = acoes.criar.isPending;

  async function adicionar(e: React.FormEvent) {
    e.preventDefault();
    try {
      await acoes.criar.mutateAsync({ nome, tipo, valor: valor.trim() === "" ? "0" : valor });
      toast.success("Convênio adicionado.");
      setErros({});
      setNome("");
      setValor("");
      setTipo("convenio");
    } catch (err) {
      setErros(err instanceof ErroServico ? err.campos : {});
      toast.error(mensagemDeErro(err));
    }
  }

  async function atualizar(id: string, patch: { nome?: string; tipo?: TipoConvenio; ativo?: boolean }) {
    try {
      await acoes.atualizar.mutateAsync({ id, patch });
    } catch (err) {
      toast.error(mensagemDeErro(err));
    }
  }

  async function mudarValor(id: string, texto: string, campo: HTMLInputElement) {
    const atual = valorDe(id);
    if (lerValorReais(texto) === atual) return void (campo.value = valorParaCampo(atual));
    try {
      await acoes.definirValor.mutateAsync({ id, valor: texto });
      toast.success("Valor atualizado. Vale para as próximas sessões.");
    } catch (err) {
      campo.value = valorParaCampo(atual);
      toast.error(mensagemDeErro(err));
    }
  }

  async function remover(id: string, n: string) {
    if (!confirm(`Remover "${n}"? Os pacientes vinculados ficarão sem convênio. Sessões já lançadas não mudam.`)) return;
    try {
      await acoes.remover.mutateAsync(id);
    } catch (err) {
      toast.error(mensagemDeErro(err));
    }
  }

  return (
    <section className="mt-8 rounded-2xl border bg-card">
      <div className="border-b p-4">
        <h2 className="text-base font-semibold">Tabela de valores por convênio</h2>
        <p className="text-xs text-muted-foreground">
          O valor da sessão é aplicado automaticamente às novas sessões de cada paciente, conforme o convênio escolhido no cadastro dele.
        </p>
      </div>

      <form onSubmit={adicionar} className="grid gap-2 border-b p-4 sm:grid-cols-[1fr_10rem_9rem_auto]">
        <div className="grid gap-1">
          <Input placeholder="Nome (ex.: Unimed)" value={nome} maxLength={80} onChange={(e) => setNome(e.target.value)} aria-invalid={!!erros["nome"]} />
          {erros["nome"] && <p className="text-xs text-destructive">{erros["nome"]}</p>}
        </div>
        <Select value={tipo} onValueChange={(x) => setTipo(x as TipoConvenio)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TIPOS_CONVENIO.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="grid gap-1">
          <Input inputMode="decimal" placeholder="Valor (R$)" value={valor} onChange={(e) => setValor(e.target.value)} aria-invalid={!!erros["valor"]} />
          {erros["valor"] && <p className="text-xs text-destructive">{erros["valor"]}</p>}
        </div>
        <Button type="submit" disabled={salvando}>
          {salvando ? <Loader2 className="animate-spin" /> : <Plus />} Adicionar
        </Button>
      </form>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface text-left text-xs text-muted-foreground">
            <tr>
              <th className="p-3">Nome</th>
              <th className="p-3">Tipo</th>
              <th className="p-3 text-right">Valor da sessão (R$)</th>
              <th className="p-3 text-center">Ativo</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {convenios.length === 0 && (
              <tr>
                <td colSpan={5} className="p-6 text-center text-muted-foreground">
                  Nenhum convênio cadastrado ainda.
                </td>
              </tr>
            )}
            {convenios.map((c) => (
              <tr key={c.id}>
                <td className="p-3">
                  <Input
                    key={c.nome}
                    defaultValue={c.nome}
                    maxLength={80}
                    className="h-8 min-w-40"
                    onBlur={(e) => {
                      const n = e.target.value.trim();
                      if (n === c.nome) return;
                      if (n.length < 2) {
                        e.target.value = c.nome;
                        return void toast.error("Nome do convênio: pelo menos 2 letras.");
                      }
                      void atualizar(c.id, { nome: n });
                    }}
                    onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                  />
                </td>
                <td className="p-3">
                  <Select value={c.tipo} onValueChange={(x) => atualizar(c.id, { tipo: x as TipoConvenio })}>
                    <SelectTrigger className="h-8 w-36">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIPOS_CONVENIO.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </td>
                <td className="p-3 text-right">
                  <Input
                    key={valorDe(c.id)}
                    inputMode="decimal"
                    defaultValue={valorParaCampo(valorDe(c.id))}
                    aria-label={`Valor da sessão de ${c.nome}`}
                    className="ml-auto h-8 w-28 text-right"
                    onBlur={(e) => void mudarValor(c.id, e.target.value, e.target)}
                    onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                  />
                </td>
                <td className="p-3 text-center">
                  <Switch checked={c.ativo} onCheckedChange={(x) => atualizar(c.id, { ativo: x })} />
                </td>
                <td className="p-3 text-right">
                  <Button size="icon" variant="ghost" aria-label={`Remover ${c.nome}`} onClick={() => remover(c.id, c.nome)}>
                    <Trash2 />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
