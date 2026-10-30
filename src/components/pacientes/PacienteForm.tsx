import { useRef, useState, type ReactNode } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import { buscarCep, formatarCep } from "@/lib/cep";
import { conveniosQuery } from "@/lib/queries";
import { rotuloTipoConvenio } from "@/lib/convenios";
import { formatarCpf } from "@/lib/validacao";
import { errosDoCadastro, type CadastroPaciente } from "@/services/pacientes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const NENHUM = "__nenhum";
const VAZIO: CadastroPaciente = { nome: "", ativo: true, pais: "Brasil" };

/** Copia só os campos do cadastro administrativo (sem dados clínicos, consentimento ou metadados). */
function doRegistro(p: Tables<"pacientes">): CadastroPaciente {
  const {
    id: _id,
    created_at: _c,
    updated_at: _u,
    criado_por: _cp,
    clinica_id: _cl,
    diagnostico: _d,
    cid: _ci,
    alergias: _a,
    medicamentos: _m,
    lgpd_consentimento_status: _l1,
    lgpd_consentimento_em: _l2,
    lgpd_consentimento_termo_id: _l3,
    lgpd_consentimento_documento_id: _l4,
    lgpd_consentimento_cpf: _l5,
    ...resto
  } = p;
  return resto;
}

/** Ficha administrativa do paciente (recepção). Dados clínicos ficam em outro bloco, só para a equipe terapêutica. */
export function PacienteForm({
  inicial,
  somenteLeitura,
  onSalvar,
  textoBotao = "Salvar",
}: {
  inicial?: Tables<"pacientes">;
  somenteLeitura?: boolean;
  onSalvar: (d: CadastroPaciente) => Promise<void>;
  textoBotao?: string;
}) {
  const [d, setD] = useState<CadastroPaciente>(() => (inicial ? doRegistro(inicial) : VAZIO));
  const [erros, setErros] = useState<Record<string, string>>({});
  const { data: convenios } = useSuspenseQuery(conveniosQuery);
  const [salvando, setSalvando] = useState(false);
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [avisoCep, setAvisoCep] = useState<string | null>(null);
  const consultaCep = useRef<AbortController | null>(null);
  const numeroRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const mudar = (k: keyof CadastroPaciente, valor: unknown) => {
    setD((x) => ({ ...x, [k]: valor }));
    if (erros[k]) setErros(({ [k]: _, ...resto }) => resto);
  };
  const set = (k: keyof CadastroPaciente) => (e: { target: { value: string } }) => mudar(k, e.target.value);
  const v = (k: keyof CadastroPaciente) => (d[k] as string | null | undefined) ?? "";
  const cpfAoSair = (k: keyof CadastroPaciente) => () => v(k) && mudar(k, formatarCpf(v(k)));

  /** Campo de texto padronizado, já com mensagem de erro e destaque. */
  const campo = (k: keyof CadastroPaciente, label: string, extra: Partial<React.ComponentProps<typeof Input>> = {}, className?: string) => (
    <Campo label={label} erro={erros[k]} className={className}>
      <Input value={v(k)} onChange={set(k)} aria-invalid={!!erros[k]} name={k} {...extra} />
    </Campo>
  );

  async function mudarCep(e: { target: { value: string } }) {
    const cep = formatarCep(e.target.value);
    mudar("cep", cep);
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
    const problemas = errosDoCadastro(d);
    setErros(problemas);
    const primeiro = Object.keys(problemas)[0];
    if (primeiro) {
      formRef.current?.querySelector<HTMLElement>(`[name="${primeiro}"]`)?.focus();
      return;
    }
    setSalvando(true);
    try {
      await onSalvar(d);
    } finally {
      setSalvando(false);
    }
  }

  const qtdErros = Object.keys(erros).length;

  return (
    <form ref={formRef} onSubmit={submit} noValidate>
      <fieldset disabled={somenteLeitura} className="space-y-6">
        <Secao titulo="Dados da criança">
          {campo("nome", "Nome completo *", { required: true }, "sm:col-span-2")}
          {campo("data_nascimento", "Data de nascimento", { type: "date" })}
          <Campo label="Sexo" erro={erros["sexo"]}>
            <Select value={v("sexo")} onValueChange={(x) => mudar("sexo", x)} disabled={!!somenteLeitura}>
              <SelectTrigger name="sexo">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Feminino">Feminino</SelectItem>
                <SelectItem value="Masculino">Masculino</SelectItem>
                <SelectItem value="Outro">Outro</SelectItem>
              </SelectContent>
            </Select>
          </Campo>
          {campo("cpf", "CPF", { inputMode: "numeric", onBlur: cpfAoSair("cpf"), placeholder: "000.000.000-00" })}
          {campo("escola", "Escola")}
        </Secao>

        <Secao titulo="Filiação">
          {campo("responsavel_nome", "Responsável principal")}
          {campo("responsavel_parentesco", "Parentesco", { placeholder: "Mãe, pai, avó..." })}
          {campo("responsavel_cpf", "CPF do responsável principal", { inputMode: "numeric", onBlur: cpfAoSair("responsavel_cpf") })}
          {campo("responsavel_telefone", "Telefone", { type: "tel", placeholder: "(11) 98765-4321" })}
          {campo("responsavel_email", "E-mail", { type: "email" })}
          <div className="hidden lg:block" />
          {campo("responsavel2_nome", "Segundo responsável")}
          {campo("responsavel2_parentesco", "Parentesco do segundo responsável", { placeholder: "Mãe, pai, avó..." })}
          {campo("responsavel2_cpf", "CPF do segundo responsável", { inputMode: "numeric", onBlur: cpfAoSair("responsavel2_cpf") })}
          {campo("responsavel2_telefone", "Telefone do segundo responsável", { type: "tel" })}
          {campo("responsavel2_email", "E-mail do segundo responsável", { type: "email" })}
          <div className="hidden lg:block" />
          {campo("responsavel_financeiro_nome", "Responsável financeiro")}
          {campo("responsavel_financeiro_parentesco", "Parentesco do responsável financeiro", { placeholder: "Mãe, pai, avó..." })}
          {campo("responsavel_financeiro_cpf", "CPF do responsável financeiro", {
            inputMode: "numeric",
            onBlur: cpfAoSair("responsavel_financeiro_cpf"),
          })}
          {campo("responsavel_financeiro_telefone", "Telefone do responsável financeiro", { type: "tel" })}
          {campo("responsavel_financeiro_email", "E-mail do responsável financeiro", { type: "email" })}
        </Secao>

        <Secao titulo="Endereço e convênio">
          <Campo label="CEP" erro={erros["cep"]}>
            <div className="relative">
              <Input name="cep" value={v("cep")} onChange={mudarCep} inputMode="numeric" placeholder="00000-000" maxLength={9} aria-invalid={!!erros["cep"]} />
              {buscandoCep && (
                <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
              )}
            </div>
            {avisoCep && <p className="text-xs text-destructive">{avisoCep}</p>}
          </Campo>
          {campo("endereco", "Endereço (rua, avenida...)", {}, "sm:col-span-2")}
          <Campo label="Número" erro={erros["numero"]}>
            <Input ref={numeroRef} name="numero" value={v("numero")} onChange={set("numero")} />
          </Campo>
          {campo("complemento", "Complemento", { placeholder: "Apto, bloco, casa..." }, "sm:col-span-2")}
          {campo("cidade", "Município")}
          {campo("estado", "Estado", { placeholder: "Ex.: São Paulo" })}
          <Campo label="UF" erro={erros["uf"]}>
            <Input
              name="uf"
              value={v("uf")}
              onChange={(e) => mudar("uf", e.target.value.toUpperCase().slice(0, 2))}
              placeholder="Ex.: SP"
              maxLength={2}
              aria-invalid={!!erros["uf"]}
            />
          </Campo>
          {campo("pais", "País")}
          <Campo label="Convênio / particular / liminar" erro={erros["convenio_id"]}>
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
          {campo("carteirinha", "Nº da carteirinha")}
        </Secao>

        <Secao titulo="Observações administrativas">
          <Campo label="Observações gerais" className="sm:col-span-2" erro={erros["observacoes"]}>
            <Textarea name="observacoes" rows={3} value={v("observacoes")} onChange={set("observacoes")} placeholder="Horários preferidos, transporte, contatos extras..." />
          </Campo>
          <div className="flex items-center gap-3">
            <Switch checked={d.ativo ?? true} onCheckedChange={(x) => mudar("ativo", x)} disabled={!!somenteLeitura} />
            <Label>Paciente ativo</Label>
          </div>
          <p className="text-xs text-muted-foreground sm:col-span-2 lg:col-span-3">
            Diagnóstico, CID, alergias e medicação ficam nos dados clínicos, visíveis só para a equipe terapêutica.
          </p>
        </Secao>
      </fieldset>
      {!somenteLeitura && (
        <div className="sticky bottom-20 mt-6 flex flex-wrap items-center justify-end gap-3 md:bottom-4">
          {qtdErros > 0 && (
            <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
              Confira {qtdErros === 1 ? "o campo destacado" : `os ${qtdErros} campos destacados`}.
            </p>
          )}
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

export function Campo({ label, className, erro, children }: { label: string; className?: string | undefined; erro?: string | undefined; children: ReactNode }) {
  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label className={cn("text-xs text-muted-foreground", erro && "text-destructive")}>{label}</Label>
      {children}
      {erro && <p className="text-xs font-medium text-destructive">{erro}</p>}
    </div>
  );
}
