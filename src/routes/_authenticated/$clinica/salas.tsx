import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { DoorOpen, Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { meQuery, salasQuery } from "@/lib/queries";
import { ehGestor } from "@/lib/permissions";
import { erroAmigavel } from "@/lib/ui-helpers";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/_authenticated/$clinica/salas")({
  beforeLoad: async ({ context, params }) => {
    const me = await context.queryClient.ensureQueryData(meQuery);
    if (!ehGestor(me.papeis)) throw redirect({ to: "/$clinica/painel", params });
  },
  loader: ({ context }) => context.queryClient.ensureQueryData(salasQuery),
  head: () => ({ meta: [{ title: "Salas — CliniHelp" }] }),
  component: SalasPage,
});

function SalasPage() {
  const qc = useQueryClient();
  const { data: salas } = useSuspenseQuery(salasQuery);
  const [nome, setNome] = useState("");
  const [desc, setDesc] = useState("");

  const recarregar = () => qc.invalidateQueries({ queryKey: ["salas"] });

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim()) return;
    const { error } = await supabase.from("salas").insert({ nome: nome.trim(), descricao: desc.trim() || null });
    if (error) { toast.error(erroAmigavel(error.message)); return; }
    setNome("");
    setDesc("");
    recarregar();
  }

  async function atualizar(id: string, patch: { nome?: string; descricao?: string | null; ativa?: boolean }) {
    const { error } = await supabase.from("salas").update(patch).eq("id", id);
    if (error) { toast.error(erroAmigavel(error.message)); return; }
    recarregar();
  }

  return (
    <div className="max-w-3xl">
      <PageHeader titulo="Salas" descricao="Salas usadas na agenda. Uma sala não pode ter dois atendimentos no mesmo horário." />
      <form onSubmit={criar} className="mb-6 flex flex-col gap-2 rounded-2xl border bg-card p-4 sm:flex-row">
        <Input placeholder="Nome da sala" value={nome} onChange={(e) => setNome(e.target.value)} />
        <Input placeholder="Descrição (opcional)" value={desc} onChange={(e) => setDesc(e.target.value)} />
        <Button type="submit">
          <Plus /> Adicionar
        </Button>
      </form>
      <div className="divide-y rounded-2xl border bg-card">
        {salas.map((s) => (
          <div key={s.id} className="flex items-center gap-3 p-3">
            <DoorOpen className="size-5 shrink-0 text-primary" />
            <Input
              defaultValue={s.nome}
              className="border-transparent font-medium shadow-none focus-visible:border-input"
              onBlur={(e) => e.target.value.trim() && e.target.value !== s.nome && atualizar(s.id, { nome: e.target.value.trim() })}
            />
            <Input
              defaultValue={s.descricao ?? ""}
              placeholder="Descrição"
              className="hidden border-transparent text-muted-foreground shadow-none focus-visible:border-input sm:block"
              onBlur={(e) => e.target.value !== (s.descricao ?? "") && atualizar(s.id, { descricao: e.target.value || null })}
            />
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Switch checked={s.ativa} onCheckedChange={(v) => atualizar(s.id, { ativa: v })} />
              {s.ativa ? "Ativa" : "Inativa"}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
