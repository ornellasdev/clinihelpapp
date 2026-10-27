import { useRef, useState, type ReactNode } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";
import { buscarCep, formatarCep } from "@/lib/cep";
import { conveniosQuery } from "@/lib/queries";
import { rotuloTipoConvenio } from "@/lib/convenios";

const NENHUM = "__nenhum";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

type Dados = TablesInsert<"pacientes">;

const VAZIO: Dados = { nome: "", ativo: true, pais: "Brasil" };

export function PacienteForm({
  inicial,
  somenteLeitura,
  onSalvar,
  textoBotao = "Salvar",
}: {
  inicial?: Tables<"pacientes">;
  somenteLeitura?: boolean;
  onSalvar: (d: Dados) => Promise<void>;
  textoBotao?: string;
}) {
  const [d, setD] = useState<Dados>(() => {
    if (!inicial) return VAZIO;
    const { id: _id, created_at: _c, updated_at: _u, ...resto } = inicial;
    return resto;
  });
  const { data: convenios } = useSuspenseQuery(conveniosQuery);
  const [salvando, setSalvando] = useState(false);
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [avisoCep, setAvisoCep] = useState<string | null>(null);
  const consultaCep = useRef<AbortController | null>(null);
  const numeroRef = useRef<HTMLInputElement>(null);
  const set = (k: keyof Dados) => (e: { target: { value: string } }) => setD((x) => ({ ...x, [k]: e.target.value }));
  const v = (k: keyof Dados) => (d[k] as string | null | undefined) ?? "";

  async function mudarCep(e: { target: { value: string } }) {
    const cep = formatarCep(e.target.value);
    setD((x) => ({ ...x, cep }));
    setAvisoCep(null);
    consultaCep.current?.abort();
    if (cep.replace(/\D/g, "").length !== 8) {
      setBuscandoCep(false);
      return;
    }
    const ctrl = new AbortController();
    consultaCep.current = ctrl;
    setBuscandoCep(true);
    try {
      const end = await buscarCep(cep, ctrl.signal);
      if (ctrl.signal.aborted) return;
      if (!end) {
        setAvisoCep("CEP não encontrado. Preencha o endereço manualmente.");
        return;
      }
      setD((x) => ({ ...x, ...end }));
      numeroRef.current?.focus();
    } catch {
      if (!ctrl.signal.aborted) setAvisoCep("Não foi possível consultar o CEP agora. Preencha manualmente.");
    } finally {
      if (!ctrl.signal.aborted) setBuscandoCep(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    try {
      const limpo = Object.fromEntries(
        Object.entries(d).map(([k, val]) => [k, typeof val === "string" && val.trim() === "" ? null : val]),
      ) as Dados;
      limpo.nome = d.nome.trim();
      await onSalvar(limpo);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <fieldset disabled={somenteLeitura} className="space-y-6">
        <Secao titulo="Dados da criança">
          <Campo label="Nome completo *" className="sm:col-span-2">
            <Input required value={v("nome")} onChange={set("nome")} />
          </Campo>
          <Campo label="Data de nascimento">
            <Input type="date" value={v("data_nascimento")} onChange={set("data_nascimento")} />
          </Campo>
          <Campo label="Sexo">
            <Select value={v("sexo")} onValueChange={(x) => setD((p) => ({ ...p, sexo: x }))} disabled={!!somenteLeitura}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Feminino">Feminino</SelectItem>
                <SelectItem value="Masculino">Masculino</SelectItem>
                <SelectItem value="Outro">Outro</SelectItem>
              </SelectContent>
            </Select>
          </Campo>
          <Campo label="CPF">
            <Input value={v("cpf")} onChange={set("cpf")} inputMode="numeric" />
          </Campo>
          <Campo label="Escola">
            <Input value={v("escola")} onChange={set("escola")} />
          </Campo>
          <Campo label="Diagnóstico" className="sm:col-span-2">
            <Input value={v("diagnostico")} onChange={set("diagnostico")} placeholder="Ex.: TEA nível 1, TDAH..." />
          </Campo>
          <Campo label="CID">
            <Input value={v("cid")} onChange={set("cid")} placeholder="Ex.: F84.0" />
          </Campo>
        </Secao>

        <Secao titulo="Filiação">
          <Campo label="Responsável principal">
            <Input value={v("responsavel_nome")} onChange={set("responsavel_nome")} />
          </Campo>
          <Campo label="Parentesco">
            <Input value={v("responsavel_parentesco")} onChange={set("responsavel_parentesco")} placeholder="Mãe, pai, avó..." />
          </Campo>
          <Campo label="CPF do responsável principal">
            <Input value={v("responsavel_cpf")} onChange={set("responsavel_cpf")} inputMode="numeric" />
          </Campo>
          <Campo label="Telefone">
            <Input type="tel" value={v("responsavel_telefone")} onChange={set("responsavel_telefone")} />
          </Campo>
          <Campo label="E-mail">
            <Input type="email" value={v("responsavel_email")} onChange={set("responsavel_email")} />
          </Campo>
          <div className="hidden lg:block" />
          <Campo label="Segundo responsável">
            <Input value={v("responsavel2_nome")} onChange={set("responsavel2_nome")} />
          </Campo>
          <Campo label="Parentesco do segundo responsável">
            <Input value={v("responsavel2_parentesco")} onChange={set("responsavel2_parentesco")} placeholder="Mãe, pai, avó..." />
          </Campo>
          <Campo label="CPF do segundo responsável">
            <Input value={v("responsavel2_cpf")} onChange={set("responsavel2_cpf")} inputMode="numeric" />
          </Campo>
          <Campo label="Telefone do segundo responsável">
            <Input type="tel" value={v("responsavel2_telefone")} onChange={set("responsavel2_telefone")} />
          </Campo>
          <Campo label="E-mail do segundo responsável">
            <Input type="email" value={v("responsavel2_email")} onChange={set("responsavel2_email")} />
          </Campo>
          <div className="hidden lg:block" />
          <Campo label="Responsável financeiro">
            <Input value={v("responsavel_financeiro_nome")} onChange={set("responsavel_financeiro_nome")} />
          </Campo>
          <Campo label="Parentesco do responsável financeiro">
            <Input value={v("responsavel_financeiro_parentesco")} onChange={set("responsavel_financeiro_parentesco")} placeholder="Mãe, pai, avó..." />
          </Campo>
          <Campo label="CPF do responsável financeiro">
            <Input value={v("responsavel_financeiro_cpf")} onChange={set("responsavel_financeiro_cpf")} inputMode="numeric" />
          </Campo>
          <Campo label="Telefone do responsável financeiro">
            <Input type="tel" value={v("responsavel_financeiro_telefone")} onChange={set("responsavel_financeiro_telefone")} />
          </Campo>
          <Campo label="E-mail do responsável financeiro">
            <Input type="email" value={v("responsavel_financeiro_email")} onChange={set("responsavel_financeiro_email")} />
          </Campo>
        </Secao>

        <Secao titulo="Endereço e convênio">
          <Campo label="CEP">
            <div className="relative">
              <Input value={v("cep")} onChange={mudarCep} inputMode="numeric" placeholder="00000-000" maxLength={9} />
              {buscandoCep && (
                <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
              )}
            </div>
            {avisoCep && <p className="text-xs text-destructive">{avisoCep}</p>}
          </Campo>
          <Campo label="Endereço (rua, avenida...)" className="sm:col-span-2">
            <Input value={v("endereco")} onChange={set("endereco")} />
          </Campo>
          <Campo label="Número">
            <Input ref={numeroRef} value={v("numero")} onChange={set("numero")} />
          </Campo>
          <Campo label="Complemento" className="sm:col-span-2">
            <Input value={v("complemento")} onChange={set("complemento")} placeholder="Apto, bloco, casa..." />
          </Campo>
          <Campo label="Município">
            <Input value={v("cidade")} onChange={set("cidade")} />
          </Campo>
          <Campo label="Estado">
            <Input value={v("estado")} onChange={set("estado")} placeholder="Ex.: São Paulo" />
          </Campo>
          <Campo label="UF">
            <Input value={v("uf")} onChange={(e) => setD((x) => ({ ...x, uf: e.target.value.toUpperCase().slice(0, 2) }))} placeholder="Ex.: SP" maxLength={2} />
          </Campo>
          <Campo label="País">
            <Input value={v("pais")} onChange={set("pais")} />
          </Campo>
          <Campo label="Convênio / particular / liminar">
            <Select
              value={d.convenio_id ?? NENHUM}
              onValueChange={(x) => {
                const c = convenios.find((c) => c.id === x);
                setD((p) => ({ ...p, convenio_id: c?.id ?? null, convenio: c?.nome ?? null }));
              }}
              disabled={!!somenteLeitura}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NENHUM}>Não informado</SelectItem>
                {convenios
                  .filter((c) => c.ativo || c.id === d.convenio_id)
                  .map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome} · {rotuloTipoConvenio(c.tipo)}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            {!d.convenio_id && d.convenio && (
              <p className="text-xs text-muted-foreground">Informado antes: {d.convenio}. Escolha na lista para vincular o valor.</p>
            )}
            {convenios.length === 0 && (
              <p className="text-xs text-muted-foreground">Nenhum convênio cadastrado. O financeiro cadastra na tela Financeiro.</p>
            )}
          </Campo>
          <Campo label="Nº da carteirinha">
            <Input value={v("carteirinha")} onChange={set("carteirinha")} />
          </Campo>
        </Secao>

        <Secao titulo="Saúde">
          <Campo label="Alergias">
            <Textarea rows={2} value={v("alergias")} onChange={set("alergias")} />
          </Campo>
          <Campo label="Medicamentos em uso">
            <Textarea rows={2} value={v("medicamentos")} onChange={set("medicamentos")} />
          </Campo>
          <Campo label="Observações gerais" className="sm:col-span-2">
            <Textarea rows={3} value={v("observacoes")} onChange={set("observacoes")} />
          </Campo>
          <div className="flex items-center gap-3">
            <Switch checked={d.ativo ?? true} onCheckedChange={(x) => setD((p) => ({ ...p, ativo: x }))} disabled={!!somenteLeitura} />
            <Label>Paciente ativo</Label>
          </div>
        </Secao>
      </fieldset>
      {!somenteLeitura && (
        <div className="sticky bottom-20 mt-6 flex justify-end md:bottom-4">
          <Button type="submit" size="lg" disabled={salvando} className="shadow-lg">
            {salvando && <Loader2 className="animate-spin" />} {textoBotao}
          </Button>
        </div>
      )}
    </form>
  );
}

function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border bg-card p-5">
      <h2 className="mb-4 text-base font-semibold">{titulo}</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </section>
  );
}

function Campo({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <div className={`grid gap-1.5 ${className ?? ""}`}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
