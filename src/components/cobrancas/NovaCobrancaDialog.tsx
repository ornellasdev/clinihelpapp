import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { addDays, addMonths, format, parseISO, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { AlertTriangle, Loader2 } from "lucide-react";
import { convenioValoresQuery, pacienteQuery, sessoesParaCobrarQuery } from "@/lib/queries";
import { descricaoCobrancaAvaliacao } from "@/lib/avaliacao-inicial";
import { criarCobranca } from "@/lib/cobrancas.functions";
import { novaCobrancaSchema } from "@/lib/cobranca-schema";
import { errosPorCampo, mensagemDeErro } from "@/services/resultado";
import {
  FORMAS_COBRANCA,
  STATUS_QUE_PRENDEM_SESSAO,
  cpfValido,
  pagadorDoPaciente,
  type FormaCobranca,
  type StatusCobranca,
} from "@/lib/cobrancas";
import { formatarMoeda } from "@/lib/financeiro";
import { ehFaturavel } from "@/lib/agenda-status";
import { STATUS_AGENDA, fmtData, fmtHora } from "@/lib/ui-helpers";
import { PacienteCombobox } from "@/components/PacienteCombobox";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

const mesAtual = () => format(new Date(), "yyyy-MM");

export function NovaCobrancaDialog({
  aberta,
  onClose,
  onCriada,
  pacienteFixo,
  avaliacaoInicial = false,
}: {
  aberta: boolean;
  onClose: () => void;
  onCriada: (id: string) => void;
  /** Abre já com este paciente (sem trocar). */
  pacienteFixo?: string;
  /** Cobrança da avaliação inicial: valor livre com o preço da sessão do convênio do paciente. */
  avaliacaoInicial?: boolean;
}) {
  const criar = useServerFn(criarCobranca);
  const qc = useQueryClient();
  const [pacienteId, setPacienteId] = useState(pacienteFixo ?? "");
  const [modo, setModo] = useState<"sessoes" | "avulsa">(avaliacaoInicial ? "avulsa" : "sessoes");
  const [mes, setMes] = useState(mesAtual());
  const [marcadas, setMarcadas] = useState<Set<string>>(new Set());
  const [valor, setValor] = useState("");
  const [valorEditado, setValorEditado] = useState(false);
  const [descricao, setDescricao] = useState("");
  const [descEditada, setDescEditada] = useState(false);
  const [vencimento, setVencimento] = useState(format(addDays(new Date(), 3), "yyyy-MM-dd"));
  const [forma, setForma] = useState<FormaCobranca>("todas");
  const [enviando, setEnviando] = useState(false);
  const [erros, setErros] = useState<Record<string, string>>({});

  const ini = startOfMonth(parseISO(`${mes}-01`));
  const { data: paciente } = useQuery({ ...pacienteQuery(pacienteId), enabled: !!pacienteId });
  const { data: precos = [] } = useQuery({ ...convenioValoresQuery, enabled: avaliacaoInicial });
  const precoSessao = avaliacaoInicial ? precos.find((p) => p.convenio_id === paciente?.convenio_id)?.valor_sessao : undefined;
  useEffect(() => {
    if (avaliacaoInicial && !valorEditado && precoSessao != null) setValor(Number(precoSessao).toFixed(2).replace(".", ","));
  }, [avaliacaoInicial, precoSessao, valorEditado]);
  const { data: sessoes = [], isFetching } = useQuery(
    sessoesParaCobrarQuery(modo === "sessoes" ? pacienteId : "", ini.toISOString(), addMonths(ini, 1).toISOString()),
  );

  const disponiveis = useMemo(
    () =>
      sessoes.map((s) => ({
        ...s,
        presa: (s.itens ?? []).some((i) => i.cobranca && STATUS_QUE_PRENDEM_SESSAO.includes(i.cobranca.status as StatusCobranca)),
        pagaNoFinanceiro: s.fin?.pagamento_status === "pago",
      })),
    [sessoes],
  );

  // Ao trocar paciente/mês, marca as sessões finalizadas e faltas cobradas ainda não cobradas.
  useEffect(() => {
    setMarcadas(new Set(disponiveis.filter((s) => !s.presa && !s.pagaNoFinanceiro && ehFaturavel(s.status)).map((s) => s.id)));
  }, [disponiveis]);

  const soma = disponiveis.filter((s) => marcadas.has(s.id)).reduce((t, s) => t + Number(s.fin?.valor ?? 0), 0);
  const nomeMes = format(ini, "MMMM/yyyy", { locale: ptBR });

  useEffect(() => {
    if (modo === "sessoes" && !valorEditado) setValor(soma ? soma.toFixed(2) : "");
  }, [soma, modo, valorEditado]);
  useEffect(() => {
    if (descEditada || !paciente) return;
    if (avaliacaoInicial) setDescricao(descricaoCobrancaAvaliacao(paciente.nome));
    else if (modo === "avulsa") setDescricao(`Atendimento — ${paciente.nome}`);
    else setDescricao(marcadas.size === 1 ? `Sessão de ${paciente.nome}` : `Sessões de ${nomeMes} — ${paciente.nome}`);
  }, [modo, marcadas.size, paciente, nomeMes, descEditada, avaliacaoInicial]);

  const pagador = paciente ? pagadorDoPaciente(paciente) : null;
  const pagadorOk = !!pagador?.nome && cpfValido(pagador.cpf);

  function limpar() {
    setPacienteId(pacienteFixo ?? ""); setModo(avaliacaoInicial ? "avulsa" : "sessoes"); setMes(mesAtual()); setMarcadas(new Set()); setValor(""); setValorEditado(false);
    setDescricao(""); setDescEditada(false); setVencimento(format(addDays(new Date(), 3), "yyyy-MM-dd")); setForma("todas");
  }

  function alternar(id: string, v: boolean) {
    setMarcadas((m) => {
      const n = new Set(m);
      if (v) n.add(id);
      else n.delete(id);
      return n;
    });
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!pacienteId) { toast.error("Escolha o paciente."); return; }
    if (modo === "sessoes" && marcadas.size === 0) { toast.error("Marque ao menos uma sessão, ou use “Valor livre”."); return; }
    const r0 = novaCobrancaSchema.safeParse({
      pacienteId,
      sessoes: modo === "sessoes" ? [...marcadas] : [],
      valor,
      vencimento,
      descricao,
      forma,
      ...(avaliacaoInicial ? { avaliacaoInicial: true } : {}),
    });
    if (!r0.success) {
      const campos = errosPorCampo(r0.error.issues);
      setErros(campos);
      toast.error(Object.values(campos)[0] ?? "Confira os dados da cobrança.");
      return;
    }
    setErros({});
    setEnviando(true);
    try {
      const r = await criar({ data: r0.data });
      toast.success("Cobrança gerada!");
      qc.invalidateQueries({ queryKey: ["cobrancas"] });
      if (avaliacaoInicial) qc.invalidateQueries({ queryKey: ["avaliacao-inicial"] });
      limpar();
      onCriada(r.id);
      onClose();
    } catch (err) {
      toast.error(mensagemDeErro(err));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Dialog open={aberta} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{avaliacaoInicial ? "Cobrança da avaliação inicial" : "Nova cobrança"}</DialogTitle>
          <DialogDescription>
            {avaliacaoInicial
              ? "Valor de uma sessão normal, como garantia. Quando for paga, o formulário de avaliação é liberado na Área da família."
              : "O responsável recebe um link do CliniHelp para pagar por Pix, boleto ou cartão."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={salvar} className="min-w-0 space-y-4">
          {pacienteFixo ? (
            paciente && <div className="text-sm"><span className="text-muted-foreground">Paciente: </span><span className="font-medium">{paciente.nome}</span></div>
          ) : (
            <div className="space-y-2">
              <Label>Paciente</Label>
              <PacienteCombobox value={pacienteId} onChange={(id) => { setPacienteId(id); setDescEditada(false); setValorEditado(false); }} />
            </div>
          )}

          {pagador && (
            <div className={cn("rounded-xl border p-3 text-sm", pagadorOk ? "bg-muted/40" : "border-warning/50 bg-warning/10")}>
              {pagadorOk ? (
                <>
                  <span className="text-muted-foreground">Pagador ({pagador.origem === "financeiro" ? "responsável financeiro" : "responsável principal"}): </span>
                  <span className="font-medium">{pagador.nome}</span>
                  <span className="text-muted-foreground"> · CPF {pagador.cpf?.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")}</span>
                </>
              ) : (
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
                  Cadastre o nome e um CPF válido do responsável financeiro no cadastro do paciente antes de cobrar.
                </div>
              )}
            </div>
          )}

          {avaliacaoInicial && paciente && precoSessao == null && (
            <p className="rounded-xl border border-warning/50 bg-warning/10 p-3 text-sm">
              O convênio do paciente não tem valor de sessão na tabela. Digite o valor da sessão normal.
            </p>
          )}
          {!avaliacaoInicial && <Tabs value={modo} onValueChange={(v) => { setModo(v as typeof modo); setValorEditado(false); setDescEditada(false); }}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="sessoes">Sessões (uma ou o mês)</TabsTrigger>
              <TabsTrigger value="avulsa">Valor livre</TabsTrigger>
            </TabsList>
          </Tabs>}

          {modo === "sessoes" && (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="cb-mes">Mês das sessões</Label>
                <Input id="cb-mes" type="month" value={mes} onChange={(e) => e.target.value && setMes(e.target.value)} className="w-auto" />
              </div>
              <div className="max-h-64 overflow-y-auto rounded-xl border">
                {!pacienteId && <div className="p-4 text-center text-sm text-muted-foreground">Escolha o paciente para ver as sessões.</div>}
                {pacienteId && isFetching && <Loader2 className="mx-auto my-4 size-5 animate-spin text-muted-foreground" />}
                {pacienteId && !isFetching && disponiveis.length === 0 && (
                  <div className="p-4 text-center text-sm text-muted-foreground">Nenhuma sessão neste mês.</div>
                )}
                <ul className="divide-y">
                  {disponiveis.map((s) => (
                    <li key={s.id}>
                      <label className={cn("flex cursor-pointer items-center gap-3 px-3 py-2 text-sm", s.presa && "cursor-not-allowed opacity-50")}>
                        <Checkbox checked={marcadas.has(s.id)} disabled={s.presa} onCheckedChange={(v) => alternar(s.id, v === true)} />
                        <span className="w-24 shrink-0">
                          {fmtData(s.inicio, "dd/MM")} <span className="text-muted-foreground">{fmtHora(s.inicio)}</span>
                        </span>
                        <span className="min-w-0 flex-1 truncate">
                          {s.especialidade?.nome} <span className="text-muted-foreground">· {s.profissional?.nome}</span>
                        </span>
                        <span className={cn("hidden rounded-full px-2 py-0.5 text-xs sm:inline", STATUS_AGENDA[s.status].className)}>
                          {STATUS_AGENDA[s.status].label}
                        </span>
                        <span className="w-24 shrink-0 text-right font-medium">
                          {s.presa ? "Já cobrada" : s.pagaNoFinanceiro ? "Já paga" : formatarMoeda(Number(s.fin?.valor ?? 0))}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
              <p className="text-xs text-muted-foreground">
                {marcadas.size} sessão(ões) marcada(s) · soma {formatarMoeda(soma)}. O financeiro pode ajustar o valor final abaixo.
              </p>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="cb-valor">Valor (R$)</Label>
              <Input
                id="cb-valor"
                inputMode="decimal"
                required
                value={valor}
                onChange={(e) => { setValor(e.target.value); setValorEditado(true); }}
                aria-invalid={!!erros["valor"]}
              />
              {erros["valor"] && <p className="text-xs text-destructive">{erros["valor"]}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="cb-venc">Vencimento</Label>
              <Input id="cb-venc" type="date" required min={format(new Date(), "yyyy-MM-dd")} value={vencimento} onChange={(e) => setVencimento(e.target.value)} aria-invalid={!!erros["vencimento"]} />
              {erros["vencimento"] && <p className="text-xs text-destructive">{erros["vencimento"]}</p>}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="cb-desc">Descrição (aparece para o responsável)</Label>
            <Input id="cb-desc" required maxLength={500} value={descricao} onChange={(e) => { setDescricao(e.target.value); setDescEditada(true); }} aria-invalid={!!erros["descricao"]} />
            {erros["descricao"] && <p className="text-xs text-destructive">{erros["descricao"]}</p>}
          </div>
          <div className="space-y-2">
            <Label>Forma de pagamento</Label>
            <Select value={forma} onValueChange={(v) => setForma(v as FormaCobranca)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FORMAS_COBRANCA.map((f) => (
                  <SelectItem key={f.value} value={f.value}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={enviando || !pagadorOk}>
              {enviando && <Loader2 className="animate-spin" />} Gerar cobrança
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
