import { useState } from "react";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { FileDown, Loader2, PenLine, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { anamneseQuery, especialidadesQuery } from "@/lib/queries";
import { useMe } from "@/hooks/use-me";
import { SECOES_ANAMNESE, campoVisivel, textoDaResposta, type Respostas } from "@/lib/anamnese";
import { erroAmigavel, fmtData } from "@/lib/ui-helpers";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

/** Entrevista inicial enviada pela família + parecer do profissional (encaminhamentos, condutas, assinatura). */
export function AnamneseTab({ pacienteId, pacienteNome }: { pacienteId: string; pacienteNome: string }) {
  const me = useMe();
  const { data } = useSuspenseQuery(anamneseQuery(pacienteId));
  const { data: especialidades } = useSuspenseQuery(especialidadesQuery);
  const [gerando, setGerando] = useState(false);
  const { anamnese, pareceres } = data;

  if (!anamnese)
    return (
      <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
        A família ainda não enviou o formulário de avaliação inicial.
      </div>
    );

  const r = anamnese.respostas as Respostas;
  const minhas = especialidades.filter((e) => me.especialidades.includes(e.id));

  async function pdf() {
    setGerando(true);
    try {
      const { gerarPdfAnamnese } = await import("@/lib/anamnese-pdf");
      await gerarPdfAnamnese({
        clinica: me.clinica?.nome ?? "Clínica",
        paciente: pacienteNome,
        anamnese: anamnese!,
        pareceres: pareceres.map((p) => ({ ...p, especialidade: p.especialidade?.nome ?? "" })),
      });
    } catch {
      toast.error("Não foi possível gerar o PDF.");
    } finally {
      setGerando(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border bg-card p-4">
        <div className="flex items-start gap-3 text-sm">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-success" />
          <div>
            <div className="font-medium">Entrevista inicial com pais e responsáveis</div>
            <div className="text-muted-foreground">
              Enviada por {anamnese.preenchido_por_nome} ({anamnese.preenchido_por_parentesco}) em{" "}
              {fmtData(anamnese.created_at, "dd/MM/yyyy 'às' HH:mm")}, com declaração de veracidade e ciência LGPD. Não pode ser alterada.
            </div>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={pdf} disabled={gerando}>
          {gerando ? <Loader2 className="animate-spin" /> : <FileDown />} Baixar PDF
        </Button>
      </div>

      <Accordion type="multiple" defaultValue={[SECOES_ANAMNESE[0]!.id]} className="rounded-2xl border bg-card px-4">
        {SECOES_ANAMNESE.map((s) => (
          <AccordionItem key={s.id} value={s.id}>
            <AccordionTrigger className="text-left">{s.titulo}</AccordionTrigger>
            <AccordionContent>
              <dl className="space-y-3">
                {s.campos
                  .filter((c) => campoVisivel(c, r))
                  .map((c) => (
                    <div key={c.id}>
                      {c.grupo && <div className="mb-1 mt-3 text-xs font-semibold uppercase tracking-wide text-primary">{c.grupo}</div>}
                      <dt className="text-xs text-muted-foreground">{c.rotulo}</dt>
                      <dd className="whitespace-pre-wrap text-sm">{textoDaResposta(c, r[c.id])}</dd>
                    </div>
                  ))}
              </dl>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>

      <section className="space-y-3">
        <h3 className="font-semibold">Parecer do profissional</h3>
        {pareceres.length === 0 && <p className="text-sm text-muted-foreground">Nenhum parecer registrado ainda.</p>}
        {pareceres.map((p) => (
          <div key={p.id} className="rounded-2xl border bg-card p-4 text-sm">
            <div className="mb-2 text-xs text-muted-foreground">
              {p.especialidade?.nome} · {p.profissional_nome}
              {p.profissional_registro && ` · ${p.profissional_registro}`} · {fmtData(p.created_at, "dd/MM/yyyy HH:mm")}
            </div>
            <div className="font-medium">Encaminhamentos ou avaliações complementares</div>
            <p className="mb-2 whitespace-pre-wrap">{p.encaminhamentos}</p>
            <div className="font-medium">Condutas iniciais e próximos passos</div>
            <p className="whitespace-pre-wrap">{p.condutas}</p>
          </div>
        ))}
        {minhas.length > 0 && <NovoParecer pacienteId={pacienteId} especialidades={minhas} />}
      </section>
    </div>
  );
}

function NovoParecer({ pacienteId, especialidades }: { pacienteId: string; especialidades: { id: string; nome: string }[] }) {
  const qc = useQueryClient();
  const [aberto, setAberto] = useState(false);
  const [esp, setEsp] = useState(especialidades.length === 1 ? especialidades[0]!.id : "");
  const [encaminhamentos, setEncaminhamentos] = useState("");
  const [condutas, setCondutas] = useState("");
  const [salvando, setSalvando] = useState(false);

  if (!aberto)
    return (
      <Button variant="secondary" onClick={() => setAberto(true)}>
        <PenLine /> Registrar meu parecer
      </Button>
    );

  async function salvar() {
    if (!esp || !encaminhamentos.trim() || !condutas.trim()) return void toast.error("Preencha a especialidade, os encaminhamentos e as condutas.");
    setSalvando(true);
    const { error } = await supabase
      .from("anamnese_pareceres")
      .insert({ paciente_id: pacienteId, especialidade_id: esp, encaminhamentos: encaminhamentos.trim(), condutas: condutas.trim() });
    setSalvando(false);
    if (error) return void toast.error(erroAmigavel(error.message));
    toast.success("Parecer registrado e assinado com seu nome e registro.");
    qc.invalidateQueries({ queryKey: ["anamnese", pacienteId] });
    setAberto(false);
    setEncaminhamentos("");
    setCondutas("");
  }

  return (
    <div className="space-y-3 rounded-2xl border bg-card p-4">
      <div className="space-y-2">
        <Label>Especialidade</Label>
        <Select value={esp} onValueChange={setEsp}>
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
      </div>
      <div className="space-y-2">
        <Label htmlFor="par-enc">Encaminhamentos ou avaliações complementares a considerar</Label>
        <Textarea id="par-enc" rows={3} maxLength={5000} value={encaminhamentos} onChange={(e) => setEncaminhamentos(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="par-cond">Condutas iniciais e próximos passos</Label>
        <Textarea id="par-cond" rows={3} maxLength={5000} value={condutas} onChange={(e) => setCondutas(e.target.value)} />
      </div>
      <p className="text-xs text-muted-foreground">Depois de salvo, o parecer não pode ser alterado (vale como sua assinatura).</p>
      <div className="flex gap-2">
        <Button variant="outline" onClick={() => setAberto(false)}>
          Cancelar
        </Button>
        <Button onClick={salvar} disabled={salvando}>
          {salvando && <Loader2 className="animate-spin" />} Salvar e assinar
        </Button>
      </div>
    </div>
  );
}
