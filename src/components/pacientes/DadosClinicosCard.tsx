import { useState } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { HeartPulse, Loader2, Lock } from "lucide-react";
import { toast } from "sonner";
import { dadosClinicosQuery, type DadosClinicos } from "@/services/pacientes";
import { useSalvarDadosClinicos } from "@/hooks/use-pacientes";
import { ErroServico, mensagemDeErro } from "@/services/resultado";
import { fmtData } from "@/lib/ui-helpers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Campo } from "./PacienteForm";

/** Dados clínicos do paciente — só aparece para o master e o terapeuta do paciente (o banco garante). */
export function DadosClinicosCard({ pacienteId }: { pacienteId: string }) {
  const { data } = useSuspenseQuery(dadosClinicosQuery(pacienteId));
  const salvar = useSalvarDadosClinicos(pacienteId);
  const [d, setD] = useState<DadosClinicos>({
    diagnostico: data?.diagnostico ?? "",
    cid: data?.cid ?? "",
    alergias: data?.alergias ?? "",
    medicamentos: data?.medicamentos ?? "",
  });
  const [erros, setErros] = useState<Record<string, string>>({});
  const set = (k: keyof DadosClinicos) => (e: { target: { value: string } }) => {
    setD((x) => ({ ...x, [k]: e.target.value }));
    setErros(({ [k]: _, ...r }) => r);
  };
  const v = (k: keyof DadosClinicos) => String(d[k] ?? "");

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    try {
      await salvar.mutateAsync(d);
      setErros({});
      toast.success("Dados clínicos salvos.");
    } catch (err) {
      if (err instanceof ErroServico && err.campo) setErros(err.campos);
      toast.error(mensagemDeErro(err));
    }
  }

  return (
    <form onSubmit={enviar} noValidate className="rounded-2xl border border-primary/25 bg-card p-5">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <HeartPulse className="size-5 text-primary" />
        <h2 className="text-base font-semibold">Dados clínicos</h2>
        <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">
          <Lock className="size-3" /> Só equipe terapêutica
        </span>
        {data?.updated_at && <span className="ml-auto text-xs text-muted-foreground">Atualizado em {fmtData(data.updated_at, "dd/MM/yyyy HH:mm")}</span>}
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Campo label="Diagnóstico" className="sm:col-span-2" erro={erros["diagnostico"]}>
          <Input value={v("diagnostico")} onChange={set("diagnostico")} placeholder="Ex.: TEA nível 1, TDAH..." aria-invalid={!!erros["diagnostico"]} />
        </Campo>
        <Campo label="CID" erro={erros["cid"]}>
          <Input value={v("cid")} onChange={set("cid")} placeholder="Ex.: F84.0" aria-invalid={!!erros["cid"]} />
        </Campo>
        <Campo label="Alergias" className="sm:col-span-3 lg:col-span-1" erro={erros["alergias"]}>
          <Textarea rows={2} value={v("alergias")} onChange={set("alergias")} />
        </Campo>
        <Campo label="Medicamentos em uso" className="sm:col-span-3 lg:col-span-2" erro={erros["medicamentos"]}>
          <Textarea rows={2} value={v("medicamentos")} onChange={set("medicamentos")} />
        </Campo>
      </div>
      <div className="mt-4 flex justify-end">
        <Button type="submit" disabled={salvar.isPending}>
          {salvar.isPending && <Loader2 className="animate-spin" />} Salvar dados clínicos
        </Button>
      </div>
    </form>
  );
}
