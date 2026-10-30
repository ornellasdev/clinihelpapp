import { useState } from "react";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { FileText, Loader2, Pencil, Plus, Settings2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { modelosEvolucaoQuery } from "@/lib/queries";
import { MODELO_PADRAO } from "@/lib/plano-terapeutico";
import { erroAmigavel } from "@/lib/ui-helpers";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Modelo = Tables<"modelos_evolucao">;

/** Botões de modelo da especialidade: um toque preenche o texto. */
export function ModelosEvolucao({
  especialidadeId,
  especialidadeNome,
  onUsar,
}: {
  especialidadeId: string;
  especialidadeNome: string;
  onUsar: (conteudo: string) => void;
}) {
  const { data: todos } = useSuspenseQuery(modelosEvolucaoQuery);
  const [gerir, setGerir] = useState(false);
  if (!especialidadeId) return null;
  const modelos = todos.filter((m) => m.especialidade_id === especialidadeId);
  const lista = modelos.length ? modelos : [{ id: "padrao", ...MODELO_PADRAO }];

  return (
    <div className="mt-4">
      <div className="mb-1.5 flex items-center gap-2 text-xs text-muted-foreground">
        <FileText className="size-3.5" /> Modelos de {especialidadeNome}
      </div>
      <div className="flex flex-wrap gap-2">
        {lista.map((m) => (
          <Button key={m.id} type="button" size="sm" variant="outline" className="rounded-full" onClick={() => onUsar(m.conteudo)}>
            {m.nome}
          </Button>
        ))}
        <Button type="button" size="sm" variant="ghost" className="rounded-full" onClick={() => setGerir(true)}>
          <Settings2 /> Gerenciar
        </Button>
      </div>
      <GerirModelos
        aberto={gerir}
        onClose={() => setGerir(false)}
        especialidadeId={especialidadeId}
        especialidadeNome={especialidadeNome}
        modelos={modelos}
      />
    </div>
  );
}

function GerirModelos({
  aberto,
  onClose,
  especialidadeId,
  especialidadeNome,
  modelos,
}: {
  aberto: boolean;
  onClose: () => void;
  especialidadeId: string;
  especialidadeNome: string;
  modelos: Modelo[];
}) {
  const qc = useQueryClient();
  const [editando, setEditando] = useState<{ id?: string; nome: string; conteudo: string } | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    if (!editando || !editando.nome.trim() || !editando.conteudo.trim()) {
      toast.error("Dê um nome e escreva o modelo.");
      return;
    }
    setSalvando(true);
    const payload = { nome: editando.nome.trim(), conteudo: editando.conteudo.trim() };
    const { error } = editando.id
      ? await supabase.from("modelos_evolucao").update(payload).eq("id", editando.id)
      : await supabase.from("modelos_evolucao").insert({ ...payload, especialidade_id: especialidadeId });
    setSalvando(false);
    if (error) {
      toast.error(erroAmigavel(error.message));
      return;
    }
    toast.success("Modelo salvo.");
    setEditando(null);
    qc.invalidateQueries({ queryKey: ["modelos_evolucao"] });
  }

  async function remover(id: string) {
    const { error } = await supabase.from("modelos_evolucao").delete().eq("id", id);
    if (error) {
      toast.error(erroAmigavel(error.message));
      return;
    }
    qc.invalidateQueries({ queryKey: ["modelos_evolucao"] });
  }

  return (
    <Dialog open={aberto} onOpenChange={(o) => !o && (setEditando(null), onClose())}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Modelos de {especialidadeNome}</DialogTitle>
          <DialogDescription>Valem para todos os profissionais desta especialidade na clínica.</DialogDescription>
        </DialogHeader>

        {editando ? (
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label>Nome</Label>
              <Input value={editando.nome} maxLength={80} onChange={(e) => setEditando({ ...editando, nome: e.target.value })} placeholder="Ex.: Sessão de linguagem" />
            </div>
            <div className="grid gap-1.5">
              <Label>Texto do modelo</Label>
              <Textarea
                className="min-h-56"
                maxLength={5000}
                value={editando.conteudo}
                onChange={(e) => setEditando({ ...editando, conteudo: e.target.value })}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setEditando(null)}>
                Voltar
              </Button>
              <Button onClick={salvar} disabled={salvando}>
                {salvando && <Loader2 className="animate-spin" />} Salvar modelo
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid gap-2">
            {modelos.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhum modelo próprio ainda. Enquanto isso, aparece o modelo padrão.</p>
            )}
            {modelos.map((m) => (
              <div key={m.id} className="flex items-center gap-2 rounded-xl border p-3">
                <span className="flex-1 truncate font-medium">{m.nome}</span>
                <Button size="icon" variant="ghost" aria-label={`Editar ${m.nome}`} onClick={() => setEditando({ id: m.id, nome: m.nome, conteudo: m.conteudo })}>
                  <Pencil />
                </Button>
                <Button size="icon" variant="ghost" aria-label={`Remover ${m.nome}`} onClick={() => remover(m.id)}>
                  <Trash2 />
                </Button>
              </div>
            ))}
            <Button variant="secondary" onClick={() => setEditando({ nome: "", conteudo: MODELO_PADRAO.conteudo })}>
              <Plus /> Novo modelo
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
