import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Download, FileText, Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { documentosQuery } from "@/lib/queries";
import { useMe } from "@/hooks/use-me";
import { ehGestor } from "@/lib/permissions";
import { erroAmigavel, fmtData } from "@/lib/ui-helpers";
import { REGRA_DOCUMENTO } from "@/lib/validacao";
import { BUCKETS, abrirArquivoPrivado, caminhoArquivo, desfazerEnvio, enviarArquivo } from "@/services/arquivos";
import { mensagemDeErro } from "@/services/resultado";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const CATEGORIAS = ["Laudo", "Relatório", "Exame", "Receita", "Atestado", "Documento pessoal", "Termo / contrato", "Encaminhamento", "Outros"];
const CLINICAS = new Set(["Laudo", "Relatório", "Exame", "Receita"]);

function tamanho(b?: number | null) {
  if (!b) return "";
  return b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(b / 1024)} KB`;
}

export function DocumentosTab({ pacienteId }: { pacienteId: string }) {
  const me = useMe();
  const qc = useQueryClient();
  const { data: docs } = useSuspenseQuery(documentosQuery(pacienteId));
  const [categoria, setCategoria] = useState("Laudo");
  const [enviando, setEnviando] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  async function enviar(files: FileList | null) {
    if (!files?.length) return;
    setEnviando(true);
    for (const file of Array.from(files)) {
      let path: string;
      try {
        path = caminhoArquivo(me.clinica?.id, pacienteId, file.name);
        await enviarArquivo(BUCKETS.documentos, path, file, REGRA_DOCUMENTO);
      } catch (e) {
        toast.error(mensagemDeErro(e));
        continue;
      }
      const { error } = await supabase.from("paciente_documentos").insert({
        paciente_id: pacienteId,
        nome: file.name,
        categoria,
        storage_path: path,
        tamanho: file.size,
        mime_type: file.type,
        enviado_por: me.id,
      });
      if (error) {
        await desfazerEnvio(BUCKETS.documentos, path);
        toast.error(erroAmigavel(error.message));
      }
    }
    setEnviando(false);
    if (input.current) input.current.value = "";
    qc.invalidateQueries({ queryKey: ["documentos", pacienteId] });
    toast.success("Envio concluído.");
  }

  const baixar = (path: string) => abrirArquivoPrivado(BUCKETS.documentos, path);

  async function remover(id: string) {
    if (!confirm("Remover este documento da ficha? Ele continua guardado no histórico da clínica.")) return;
    const { error } = await supabase.from("paciente_documentos").delete().eq("id", id);
    if (error) { toast.error(erroAmigavel(error.message)); return; }
    qc.invalidateQueries({ queryKey: ["documentos", pacienteId] });
  }

  const grupos = CATEGORIAS.map((c) => [c, docs.filter((d) => d.categoria === c)] as const).filter(([, l]) => l.length);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 rounded-2xl border-2 border-dashed bg-card p-5 sm:flex-row sm:items-center">
        <Upload className="hidden size-8 text-primary sm:block" />
        <div className="flex-1">
          <div className="font-medium">Anexar documentos</div>
          <div className="text-sm text-muted-foreground">PDF, foto, Word ou Excel de até 20 MB. Pode tirar foto pelo celular.</div>
          {CLINICAS.has(categoria) && (
            <div className="mt-1 text-xs text-muted-foreground">{categoria}: visível só para o master e a equipe terapêutica do paciente (e para quem enviou).</div>
          )}
        </div>
        <Select value={categoria} onValueChange={setCategoria}>
          <SelectTrigger className="sm:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CATEGORIAS.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <input ref={input} type="file" multiple hidden onChange={(e) => enviar(e.target.files)} accept="application/pdf,image/*,.doc,.docx,.xls,.xlsx" />
        <Button onClick={() => input.current?.click()} disabled={enviando}>
          {enviando ? <Loader2 className="animate-spin" /> : <Upload />} Escolher arquivos
        </Button>
      </div>

      {docs.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Nenhum documento anexado.</p>}

      {grupos.map(([cat, lista]) => (
        <section key={cat}>
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{cat}</h3>
          <div className="divide-y rounded-2xl border bg-card">
            {lista.map((d) => (
              <div key={d.id} className="flex items-center gap-3 p-3">
                <FileText className="size-5 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{d.nome}</div>
                  <div className="text-xs text-muted-foreground">
                    {fmtData(d.created_at)} {tamanho(d.tamanho) && `· ${tamanho(d.tamanho)}`}
                    {d.sessao && ` · falta de ${fmtData(d.sessao.inicio, "dd/MM/yyyy HH:mm")}`}
                  </div>
                </div>
                <Button size="icon" variant="ghost" onClick={() => baixar(d.storage_path)} aria-label="Abrir">
                  <Download />
                </Button>
                {(ehGestor(me.papeis) || d.enviado_por === me.id) && (
                  <Button size="icon" variant="ghost" className="text-destructive" onClick={() => remover(d.id)} aria-label="Remover">
                    <Trash2 />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
