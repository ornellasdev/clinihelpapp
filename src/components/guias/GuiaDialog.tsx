import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { Loader2, Paperclip, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { conveniosQuery, especialidadesQuery, type Guia } from "@/lib/queries";
import { useMe } from "@/hooks/use-me";
import { STATUS_GRAVADOS, exigeGuia } from "@/lib/guias";
import { erroAmigavel } from "@/lib/ui-helpers";
import { REGRA_GUIA } from "@/lib/validacao";
import { BUCKETS, abrirArquivoPrivado, caminhoArquivo, desfazerEnvio, enviarArquivo } from "@/services/arquivos";
import { codigosGuiaSchema } from "@/services/guias";
import { mensagemDeErro, validar } from "@/services/resultado";
import { PacienteCombobox } from "@/components/PacienteCombobox";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export const BUCKET_GUIAS = BUCKETS.guias;

/** Abre o anexo da guia por link temporário (2 min), gerado só na hora do clique. */
export const abrirAnexoGuia = (path: string) => abrirArquivoPrivado(BUCKETS.guias, path);

const hoje = () => format(new Date(), "yyyy-MM-dd");

export function GuiaDialog({ open, onOpenChange, guia }: { open: boolean; onOpenChange: (v: boolean) => void; guia: Guia | null }) {
  const me = useMe();
  const qc = useQueryClient();
  const { data: especialidades = [] } = useQuery(especialidadesQuery);
  const { data: convenios = [] } = useQuery(conveniosQuery);
  const opcoesConvenio = convenios.filter((c) => exigeGuia(c.tipo) && (c.ativo || c.id === guia?.convenio_id));

  const [pacienteId, setPacienteId] = useState("");
  const [convenioId, setConvenioId] = useState("");
  const [especialidadeId, setEspecialidadeId] = useState("");
  const [tuss, setTuss] = useState("");
  const [codGuia, setCodGuia] = useState("");
  const [codFat, setCodFat] = useState("");
  const [solicitadas, setSolicitadas] = useState("");
  const [autorizadas, setAutorizadas] = useState("");
  const [dataSol, setDataSol] = useState(hoje());
  const [dataLib, setDataLib] = useState("");
  const [validade, setValidade] = useState("");
  const [status, setStatus] = useState("solicitada");
  const [obs, setObs] = useState("");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [removerAnexo, setRemoverAnexo] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setPacienteId(guia?.paciente_id ?? "");
    setConvenioId(guia?.convenio_id ?? "");
    setEspecialidadeId(guia?.especialidade_id ?? "");
    setTuss(guia?.codigo_tuss ?? "");
    setCodGuia(guia?.codigo_guia ?? "");
    setCodFat(guia?.codigo_faturamento ?? "");
    setSolicitadas(guia ? String(guia.sessoes_solicitadas) : "");
    setAutorizadas(guia?.sessoes_autorizadas != null ? String(guia.sessoes_autorizadas) : "");
    setDataSol(guia?.data_solicitacao ?? hoje());
    setDataLib(guia?.data_liberacao ?? "");
    setValidade(guia?.validade ?? "");
    setStatus(guia?.status ?? "solicitada");
    setObs(guia?.observacoes ?? "");
    setArquivo(null);
    setRemoverAnexo(false);
  }, [open, guia]);

  // Ao escolher o paciente numa guia nova, sugere o convênio do cadastro dele.
  async function escolherPaciente(id: string) {
    setPacienteId(id);
    if (guia || !id) return;
    const { data } = await supabase.from("pacientes").select("convenio_id").eq("id", id).maybeSingle();
    if (data?.convenio_id && opcoesConvenio.some((c) => c.id === data.convenio_id)) setConvenioId(data.convenio_id);
  }

  // Ao marcar como autorizada, já sugere as sessões e a data de hoje.
  function mudarStatus(v: string) {
    setStatus(v);
    if (v === "autorizada") {
      if (!autorizadas) setAutorizadas(solicitadas);
      if (!dataLib) setDataLib(hoje());
    }
  }

  async function salvar() {
    if (!pacienteId || !convenioId || !especialidadeId) return void toast.error("Escolha o paciente, o convênio e a especialidade.");
    let codigos: ReturnType<typeof codigosGuiaSchema.parse>;
    try {
      codigos = validar(codigosGuiaSchema, {
        codigo_tuss: tuss,
        codigo_guia: codGuia,
        codigo_faturamento: codFat,
        sessoes_solicitadas: Number(solicitadas),
        sessoes_autorizadas: autorizadas === "" ? null : Number(autorizadas),
      });
    } catch (e) {
      return void toast.error(mensagemDeErro(e));
    }
    const nAut = codigos.sessoes_autorizadas;
    if ((status === "autorizada" || status === "faturada") && (nAut === null || !dataLib || !validade))
      return void toast.error("Guia autorizada precisa de sessões autorizadas, data da liberação e validade.");
    if (validade && dataLib && validade < dataLib) return void toast.error("A validade não pode ser antes da liberação.");

    setSalvando(true);
    const id = guia?.id ?? crypto.randomUUID();
    let anexo: { anexo_path: string | null; anexo_nome: string | null; anexo_mime: string | null } | null = null;
    if (arquivo) {
      let path: string;
      try {
        path = caminhoArquivo(me.clinica?.id, id, arquivo.name);
        await enviarArquivo(BUCKETS.guias, path, arquivo, REGRA_GUIA);
      } catch (e) {
        setSalvando(false);
        return void toast.error(`Anexo: ${mensagemDeErro(e)}`);
      }
      anexo = { anexo_path: path, anexo_nome: arquivo.name.slice(0, 200), anexo_mime: arquivo.type || null };
    } else if (removerAnexo) {
      anexo = { anexo_path: null, anexo_nome: null, anexo_mime: null };
    }

    const dados = {
      paciente_id: pacienteId,
      convenio_id: convenioId,
      especialidade_id: especialidadeId,
      ...codigos,
      data_solicitacao: dataSol || hoje(),
      data_liberacao: dataLib || null,
      validade: validade || null,
      status,
      observacoes: obs.trim() || null,
      ...(anexo ?? {}),
    };
    const { error } = guia
      ? await supabase.from("guias_convenio").update(dados).eq("id", guia.id)
      : await supabase.from("guias_convenio").insert({ id, ...dados });
    setSalvando(false);
    if (error) {
      if (anexo?.anexo_path) await desfazerEnvio(BUCKETS.guias, anexo.anexo_path);
      return void toast.error(erroAmigavel(error.message));
    }
    toast.success(guia ? "Guia atualizada." : "Guia cadastrada.");
    qc.invalidateQueries({ queryKey: ["guias"] });
    onOpenChange(false);
  }

  const anexoAtual = !removerAnexo && guia?.anexo_path ? guia.anexo_nome ?? "Anexo" : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{guia ? `Guia ${guia.codigo_guia}` : "Nova guia de convênio"}</DialogTitle>
          <DialogDescription>Controle interno da clínica. A presença continua sendo validada no app da operadora.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label>Paciente</Label>
            <PacienteCombobox value={pacienteId} onChange={escolherPaciente} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo label="Convênio / operadora">
              <Select value={convenioId} onValueChange={setConvenioId}>
                <SelectTrigger>
                  <SelectValue placeholder={opcoesConvenio.length ? "Selecione" : "Cadastre em Financeiro"} />
                </SelectTrigger>
                <SelectContent>
                  {opcoesConvenio.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Campo>
            <Campo label="Especialidade">
              <Select value={especialidadeId} onValueChange={setEspecialidadeId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {especialidades.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Campo>
          </div>

          <div className="grid gap-4 rounded-xl border bg-surface p-3 sm:grid-cols-3">
            <Campo label="Código TUSS">
              <Input value={tuss} maxLength={40} inputMode="numeric" placeholder="Ex.: 50000462" onChange={(e) => setTuss(e.target.value)} />
            </Campo>
            <Campo label="Código da guia">
              <Input value={codGuia} maxLength={60} placeholder="Nº da guia" onChange={(e) => setCodGuia(e.target.value)} />
            </Campo>
            <Campo label="Código de faturamento">
              <Input value={codFat} maxLength={60} placeholder="Lote / fechamento" onChange={(e) => setCodFat(e.target.value)} />
            </Campo>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Campo label="Situação">
              <Select value={status} onValueChange={mudarStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_GRAVADOS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Campo>
            <Campo label="Sessões solicitadas">
              <Input type="number" min={1} max={999} inputMode="numeric" value={solicitadas} onChange={(e) => setSolicitadas(e.target.value)} />
            </Campo>
            <Campo label="Sessões autorizadas">
              <Input type="number" min={0} max={999} inputMode="numeric" value={autorizadas} placeholder="Após liberação" onChange={(e) => setAutorizadas(e.target.value)} />
            </Campo>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Campo label="Data da solicitação">
              <Input type="date" value={dataSol} onChange={(e) => setDataSol(e.target.value)} />
            </Campo>
            <Campo label="Data da liberação">
              <Input type="date" value={dataLib} onChange={(e) => setDataLib(e.target.value)} />
            </Campo>
            <Campo label="Validade da guia">
              <Input type="date" value={validade} onChange={(e) => setValidade(e.target.value)} />
            </Campo>
          </div>

          <Campo label="Anexo (pedido médico ou autorização)">
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={input}
                type="file"
                accept="application/pdf,image/*"
                className="hidden"
                onChange={(e) => {
                  setArquivo(e.target.files?.[0] ?? null);
                  e.target.value = "";
                }}
              />
              <Button type="button" variant="outline" size="sm" onClick={() => input.current?.click()}>
                <Paperclip /> {arquivo || anexoAtual ? "Trocar arquivo" : "Anexar PDF ou foto"}
              </Button>
              {(arquivo || anexoAtual) && (
                <span className="flex min-w-0 items-center gap-1 rounded-lg bg-secondary px-2 py-1 text-xs">
                  {anexoAtual && !arquivo ? (
                    <button type="button" className="truncate underline" onClick={() => guia?.anexo_path && abrirAnexoGuia(guia.anexo_path)}>
                      {anexoAtual}
                    </button>
                  ) : (
                    <span className="truncate">{arquivo?.name}</span>
                  )}
                  <button
                    type="button"
                    aria-label="Remover anexo"
                    onClick={() => (arquivo ? setArquivo(null) : setRemoverAnexo(true))}
                    className="rounded p-0.5 hover:bg-background"
                  >
                    <X className="size-3" />
                  </button>
                </span>
              )}
            </div>
          </Campo>

          <Campo label="Observações">
            <Textarea rows={2} maxLength={1000} value={obs} onChange={(e) => setObs(e.target.value)} />
          </Campo>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={salvar} disabled={salvando}>
            {salvando && <Loader2 className="animate-spin" />} Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
