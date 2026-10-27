import { useState } from "react";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { convenioValoresQuery, conveniosQuery } from "@/lib/queries";
import { TIPOS_CONVENIO, type TipoConvenio } from "@/lib/convenios";
import { erroAmigavel } from "@/lib/ui-helpers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

function mensagem(msg: string) {
  return msg.includes("convenios_nome_unico") ? "Já existe um convênio com esse nome." : erroAmigavel(msg);
}

export function TabelaConvenios() {
  const qc = useQueryClient();
  const { data: convenios } = useSuspenseQuery(conveniosQuery);
  const { data: valores } = useSuspenseQuery(convenioValoresQuery);
  const valorDe = (id: string) => Number(valores.find((v) => v.convenio_id === id)?.valor_sessao ?? 0);

  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState<TipoConvenio>("convenio");
  const [valor, setValor] = useState("");
  const [salvando, setSalvando] = useState(false);

  const recarregar = () => qc.invalidateQueries({ queryKey: ["convenios"] });

  async function adicionar(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim()) return;
    setSalvando(true);
    try {
      const { data, error } = await supabase.from("convenios").insert({ nome: nome.trim(), tipo }).select("id").single();
      if (error) return void toast.error(mensagem(error.message));
      const { error: e2 } = await supabase.from("convenio_valores").insert({ convenio_id: data.id, valor_sessao: Number(valor) || 0 });
      if (e2) toast.error(mensagem(e2.message));
      else toast.success("Convênio adicionado.");
      setNome("");
      setValor("");
      setTipo("convenio");
      recarregar();
    } finally {
      setSalvando(false);
    }
  }

  async function atualizar(id: string, patch: { nome?: string; tipo?: string; ativo?: boolean }) {
    const { error } = await supabase.from("convenios").update(patch).eq("id", id);
    if (error) toast.error(mensagem(error.message));
    recarregar();
  }

  async function mudarValor(id: string, v: number) {
    const { error } = await supabase
      .from("convenio_valores")
      .upsert({ convenio_id: id, valor_sessao: v, updated_at: new Date().toISOString() });
    if (error) toast.error(mensagem(error.message));
    recarregar();
  }

  async function remover(id: string, n: string) {
    if (!confirm(`Remover "${n}"? Os pacientes vinculados ficarão sem convênio. Sessões já lançadas não mudam.`)) return;
    const { error } = await supabase.from("convenios").delete().eq("id", id);
    if (error) toast.error(mensagem(error.message));
    recarregar();
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
        <Input placeholder="Nome (ex.: Unimed)" value={nome} onChange={(e) => setNome(e.target.value)} required />
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
        <Input type="number" min={0} step="0.01" placeholder="Valor (R$)" value={valor} onChange={(e) => setValor(e.target.value)} />
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
                    className="h-8 min-w-40"
                    onBlur={(e) => {
                      const n = e.target.value.trim();
                      if (n && n !== c.nome) atualizar(c.id, { nome: n });
                    }}
                    onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                  />
                </td>
                <td className="p-3">
                  <Select value={c.tipo} onValueChange={(x) => atualizar(c.id, { tipo: x })}>
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
                    type="number"
                    min={0}
                    step="0.01"
                    defaultValue={valorDe(c.id)}
                    className="ml-auto h-8 w-28 text-right"
                    onBlur={(e) => {
                      const v = Number(e.target.value);
                      if (Number.isFinite(v) && v >= 0 && v !== valorDe(c.id)) mudarValor(c.id, v);
                    }}
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
