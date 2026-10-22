import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Download, FileText, Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { documentosQuery } from "@/lib/queries";
import { useMe } from "@/hooks/use-me";
import { ehGestor } from "@/lib/permissions";
import { erroAmigavel, fmtData } from "@/lib/ui-helpers";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const CATEGORIAS = ["Laudo", "Relatório", "Exame", "Receita", "Documento pessoal", "Termo / contrato", "Encaminhamento", "Outros"];
const BUCKET = "documentos-pacientes";

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
      const seguro = file.name.normalize("NFD").replace(/[^\w.-]+/g, "_");
      const path = `${pacienteId}/${crypto.randomUUID()}-${seguro}`;
      const up = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type });
      if (up.error) {
        toast.error(`${file.name}: ${erroAmigavel(up.error.message)}`);
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
      if (error) toast.error(erroAmigavel(error.message));
    }
    setEnviando(false);
    if (input.current) input.current.value = "";
    qc.invalidateQueries({ queryKey: ["documentos", pacienteId] });
    toast.success("Envio concluído.");
  }

  async function baixar(path: string) {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 120);
    if (error || !data) { toast.error("Não foi possível abrir o arquivo."); return; }
    window.open(data.signedUrl, "_blank", "noopener");
  }

  async function remover(id: string, path: string) {
    if (!confirm("Remover este documento?")) return;
    await supabase.storage.from(BUCKET).remove([path]);
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
          <div className="text-sm text-muted-foreground">PDF, imagens ou documentos de até 20 MB. Pode tirar foto pelo celular.</div>
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
                  </div>
                </div>
                <Button size="icon" variant="ghost" onClick={() => baixar(d.storage_path)} aria-label="Abrir">
                  <Download />
                </Button>
                {(ehGestor(me.papeis) || d.enviado_por === me.id) && (
                  <Button size="icon" variant="ghost" className="text-destructive" onClick={() => remover(d.id, d.storage_path)} aria-label="Remover">
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
