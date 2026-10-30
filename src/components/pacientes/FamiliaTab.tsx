import { useState } from "react";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { CheckCircle2, Copy, FileDown, FileSignature, Loader2, Mail, Pencil, Plus, Settings2, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { BUCKETS, abrirArquivoPrivado } from "@/services/arquivos";
import type { Tables } from "@/integrations/supabase/types";
import { pacienteQuery, relatoriosLiberadosQuery, termosModelosQuery, termosPacienteQuery } from "@/lib/queries";
import { useMe } from "@/hooks/use-me";
import { ehGestor, temPapel } from "@/lib/permissions";
import { MODELOS_TERMO_PADRAO, ROTULO_DECISAO, TIPOS_TERMO, emailsDosResponsaveis, preencherTermo, type Decisao, type TipoTermo } from "@/lib/familia";
import { erroAmigavel, fmtData } from "@/lib/ui-helpers";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const STATUS_TERMO = {
  pendente: { label: "Aguardando assinatura", className: "bg-warning/20 text-warning-foreground" },
  assinado: { label: "Assinado", className: "bg-success/15 text-success" },
  cancelado: { label: "Cancelado", className: "bg-muted text-muted-foreground" },
} as const;

export function FamiliaTab({ pacienteId }: { pacienteId: string }) {
  const me = useMe();
  const { data: p } = useSuspenseQuery(pacienteQuery(pacienteId));
  const podeTermos = ehGestor(me.papeis) || temPapel(me.papeis, "recepcao");
  const veRelatorios = me.papeis.includes("master") || me.especialidades.length > 0;
  const link = typeof window !== "undefined" ? `${window.location.origin}/familia` : "/familia";

  const responsaveis = [
    { papel: "Responsável 1", nome: p.responsavel_nome, email: p.responsavel_email },
    { papel: "Responsável 2", nome: p.responsavel2_nome, email: p.responsavel2_email },
    { papel: "Responsável financeiro", nome: p.responsavel_financeiro_nome, email: p.responsavel_financeiro_email },
  ].filter((r) => r.nome || r.email);
  const comAcesso = emailsDosResponsaveis(p);

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border bg-card p-4 sm:p-5">
        <h2 className="mb-1 font-semibold">Área da família</h2>
        <p className="mb-3 text-sm text-muted-foreground">
          Os responsáveis entram com um código enviado ao e-mail da ficha e veem a agenda, as cobranças, os recibos, os relatórios liberados e os termos.
        </p>
        <div className="mb-3 flex items-center gap-2 rounded-xl bg-surface p-2 pl-3 text-sm">
          <span className="min-w-0 flex-1 truncate font-mono">{link}</span>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => navigator.clipboard.writeText(link).then(() => toast.success("Endereço copiado."))}
          >
            <Copy /> Copiar
          </Button>
        </div>
        <div className="space-y-1.5">
          {responsaveis.length === 0 && <p className="text-sm text-muted-foreground">Nenhum responsável cadastrado.</p>}
          {responsaveis.map((r) => {
            const ok = comAcesso.includes((r.email ?? "").trim().toLowerCase());
            return (
              <div key={r.papel} className="flex items-center gap-2 text-sm">
                <Mail className={cn("size-4 shrink-0", ok ? "text-success" : "text-muted-foreground")} />
                <span className="min-w-0 flex-1 truncate">
                  <span className="font-medium">{r.nome || r.papel}</span>
                  <span className="text-muted-foreground"> · {r.email || "sem e-mail — cadastre para liberar o acesso"}</span>
                </span>
              </div>
            );
          })}
        </div>
      </section>

      <TermosSecao pacienteId={pacienteId} paciente={p.nome} podeTermos={podeTermos} />
      {veRelatorios && <RelatoriosLiberadosSecao pacienteId={pacienteId} />}
    </div>
  );
}

function TermosSecao({ pacienteId, paciente, podeTermos }: { pacienteId: string; paciente: string; podeTermos: boolean }) {
  const me = useMe();
  const qc = useQueryClient();
  const { data: termos } = useSuspenseQuery(termosPacienteQuery(pacienteId));
  const [solicitar, setSolicitar] = useState(false);
  const [modelos, setModelos] = useState(false);

  async function cancelar(id: string) {
    const { error } = await supabase.from("termos_assinaturas").update({ status: "cancelado" }).eq("id", id);
    if (error) return void toast.error(erroAmigavel(error.message));
    qc.invalidateQueries({ queryKey: ["termos", pacienteId] });
  }

  async function comprovante(id: string) {
    const { data, error } = await supabase
      .from("termos_assinaturas")
      .select("titulo, tipo, texto, texto_hash, assinado_em, assinante_nome, assinante_cpf, assinante_email, assinante_parentesco, decisao, assinatura_imagem, ip, user_agent, comprovante_hash")
      .eq("id", id)
      .single();
    if (error || !data) return void toast.error("Não foi possível abrir o termo.");
    const { baixarComprovanteTermo } = await import("@/lib/documentos-familia");
    await baixarComprovanteTermo({ ...data, clinica: me.clinica?.nome ?? "", paciente });
  }

  return (
    <section className="rounded-2xl border bg-card p-4 sm:p-5">
      <header className="mb-3 flex flex-wrap items-center gap-2">
        <FileSignature className="size-5 text-primary" />
        <h2 className="font-semibold">Termos e assinaturas</h2>
        {podeTermos && (
          <div className="ml-auto flex gap-1">
            {ehGestor(me.papeis) && (
              <Button size="sm" variant="ghost" onClick={() => setModelos(true)}>
                <Settings2 /> Modelos
              </Button>
            )}
            <Button size="sm" variant="secondary" onClick={() => setSolicitar(true)}>
              <Plus /> Pedir assinatura
            </Button>
          </div>
        )}
      </header>
      {termos.length === 0 && <p className="text-sm text-muted-foreground">Nenhum termo enviado ainda.</p>}
      <div className="space-y-2">
        {termos.map((t) => {
          const st = STATUS_TERMO[t.status as keyof typeof STATUS_TERMO];
          return (
            <div key={t.id} className="flex flex-wrap items-center gap-2 rounded-xl border p-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{t.titulo}</span>
                  <span className={cn("rounded-full px-2 py-0.5 text-xs", st.className)}>{st.label}</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {t.status === "assinado"
                    ? `${ROTULO_DECISAO[t.decisao as Decisao]} · ${t.assinante_nome} (${t.assinante_parentesco}) em ${fmtData(t.assinado_em!, "dd/MM/yyyy HH:mm")}`
                    : `Enviado em ${fmtData(t.created_at)}${t.solicitado_por_nome ? ` por ${t.solicitado_por_nome}` : ""}`}
                </div>
              </div>
              {t.status === "assinado" && (
                <Button size="sm" variant="outline" onClick={() => comprovante(t.id)}>
                  <FileDown /> Comprovante
                </Button>
              )}
              {t.status === "pendente" && podeTermos && (
                <Button size="sm" variant="ghost" onClick={() => cancelar(t.id)}>
                  <X /> Cancelar
                </Button>
              )}
            </div>
          );
        })}
      </div>
      {solicitar && <SolicitarTermoDialog pacienteId={pacienteId} paciente={paciente} onClose={() => setSolicitar(false)} />}
      {modelos && <ModelosTermoDialog onClose={() => setModelos(false)} />}
    </section>
  );
}

function SolicitarTermoDialog({ pacienteId, paciente, onClose }: { pacienteId: string; paciente: string; onClose: () => void }) {
  const me = useMe();
  const qc = useQueryClient();
  const { data: modelos } = useSuspenseQuery(termosModelosQuery);
  const opcoes = [
    ...modelos.map((m) => ({ id: m.id, tipo: m.tipo as TipoTermo, titulo: m.titulo, texto: m.texto, proprio: true })),
    ...MODELOS_TERMO_PADRAO.filter((d) => !modelos.some((m) => m.tipo === d.tipo)).map((d) => ({ id: `padrao-${d.tipo}`, ...d, proprio: false })),
  ];
  const [escolha, setEscolha] = useState(opcoes[0]?.id ?? "");
  const [salvando, setSalvando] = useState(false);
  const sel = opcoes.find((o) => o.id === escolha);
  const texto = sel ? preencherTermo(sel.texto, { crianca: paciente, clinica: me.clinica?.nome ?? "a clínica" }) : "";

  async function enviar() {
    if (!sel) return;
    setSalvando(true);
    const { error } = await supabase.from("termos_assinaturas").insert({
      paciente_id: pacienteId,
      modelo_id: sel.proprio ? sel.id : null,
      tipo: sel.tipo,
      titulo: sel.titulo,
      texto,
      texto_hash: "-",
      solicitado_por_nome: me.nome,
    });
    setSalvando(false);
    if (error) return void toast.error(erroAmigavel(error.message));
    toast.success("Termo enviado. Os responsáveis assinam pela Área da família.");
    qc.invalidateQueries({ queryKey: ["termos", pacienteId] });
    onClose();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Pedir assinatura</DialogTitle>
          <DialogDescription>O texto abaixo fica congelado: é exatamente o que o responsável vai assinar.</DialogDescription>
        </DialogHeader>
        <Select value={escolha} onValueChange={setEscolha}>
          <SelectTrigger aria-label="Termo">
            <SelectValue placeholder="Escolha o termo" />
          </SelectTrigger>
          <SelectContent>
            {opcoes.map((o) => (
              <SelectItem key={o.id} value={o.id}>
                {o.titulo}
                {!o.proprio && " (modelo padrão)"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="max-h-[45dvh] overflow-y-auto whitespace-pre-wrap rounded-xl border bg-surface p-3 text-sm">{texto}</div>
        <DialogFooter>
          <Button onClick={enviar} disabled={salvando || !sel} className="w-full sm:w-auto">
            {salvando && <Loader2 className="animate-spin" />} Enviar para assinatura
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ModelosTermoDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const { data: modelos } = useSuspenseQuery(termosModelosQuery);
  const [ed, setEd] = useState<{ id?: string; tipo: TipoTermo; titulo: string; texto: string } | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    if (!ed || !ed.titulo.trim() || !ed.texto.trim()) return void toast.error("Preencha título e texto.");
    setSalvando(true);
    const payload = { tipo: ed.tipo, titulo: ed.titulo.trim(), texto: ed.texto.trim() };
    const { error } = ed.id ? await supabase.from("termos_modelos").update(payload).eq("id", ed.id) : await supabase.from("termos_modelos").insert(payload);
    setSalvando(false);
    if (error) return void toast.error(erroAmigavel(error.message));
    setEd(null);
    qc.invalidateQueries({ queryKey: ["termos_modelos"] });
  }

  async function remover(m: Tables<"termos_modelos">) {
    const { error } = await supabase.from("termos_modelos").update({ ativo: false }).eq("id", m.id);
    if (error) return void toast.error(erroAmigavel(error.message));
    qc.invalidateQueries({ queryKey: ["termos_modelos"] });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Modelos de termos da clínica</DialogTitle>
          <DialogDescription>
            Use {"{{crianca}}"} e {"{{clinica}}"} para preencher os nomes automaticamente. Revise os textos com o jurídico da clínica.
          </DialogDescription>
        </DialogHeader>
        {ed ? (
          <div className="grid gap-3">
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <Input value={ed.titulo} maxLength={150} onChange={(e) => setEd({ ...ed, titulo: e.target.value })} placeholder="Título" aria-label="Título" />
              <Select value={ed.tipo} onValueChange={(v) => setEd({ ...ed, tipo: v as TipoTermo })}>
                <SelectTrigger className="w-40" aria-label="Tipo">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(TIPOS_TERMO).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Textarea className="min-h-72 text-sm" value={ed.texto} onChange={(e) => setEd({ ...ed, texto: e.target.value })} aria-label="Texto" />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setEd(null)}>
                Voltar
              </Button>
              <Button onClick={salvar} disabled={salvando}>
                {salvando && <Loader2 className="animate-spin" />} Salvar
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid gap-2">
            {modelos.map((m) => (
              <div key={m.id} className="flex items-center gap-2 rounded-xl border p-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{m.titulo}</div>
                  <div className="text-xs text-muted-foreground">{TIPOS_TERMO[m.tipo as TipoTermo]}</div>
                </div>
                <Button size="icon" variant="ghost" aria-label={`Editar ${m.titulo}`} onClick={() => setEd({ id: m.id, tipo: m.tipo as TipoTermo, titulo: m.titulo, texto: m.texto })}>
                  <Pencil />
                </Button>
                <Button size="icon" variant="ghost" aria-label={`Remover ${m.titulo}`} onClick={() => remover(m)}>
                  <Trash2 />
                </Button>
              </div>
            ))}
            {MODELOS_TERMO_PADRAO.filter((d) => !modelos.some((m) => m.tipo === d.tipo)).map((d) => (
              <div key={d.tipo} className="flex items-center gap-2 rounded-xl border border-dashed p-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{d.titulo}</div>
                  <div className="text-xs text-muted-foreground">Modelo padrão do CliniHelp</div>
                </div>
                <Button size="sm" variant="ghost" onClick={() => setEd({ ...d })}>
                  <Pencil /> Personalizar
                </Button>
              </div>
            ))}
            <Button variant="secondary" onClick={() => setEd({ tipo: "outro", titulo: "", texto: "" })}>
              <Plus /> Novo termo
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function RelatoriosLiberadosSecao({ pacienteId }: { pacienteId: string }) {
  const me = useMe();
  const qc = useQueryClient();
  const { data } = useSuspenseQuery(relatoriosLiberadosQuery(pacienteId));

  async function revogar(r: Tables<"relatorios_liberados">) {
    const { error } = await supabase.from("relatorios_liberados").delete().eq("id", r.id);
    if (error) return void toast.error(erroAmigavel(error.message));
    // O PDF fica guardado (registro do que foi compartilhado); só deixa de aparecer para a família.
    toast.success("Relatório retirado da Área da família.");
    qc.invalidateQueries({ queryKey: ["relatorios_liberados", pacienteId] });
  }

  const abrir = (r: Tables<"relatorios_liberados">) => abrirArquivoPrivado(BUCKETS.relatorios, r.storage_path);

  return (
    <section className="rounded-2xl border bg-card p-4 sm:p-5">
      <header className="mb-1 flex items-center gap-2">
        <CheckCircle2 className="size-5 text-primary" />
        <h2 className="font-semibold">Relatórios liberados aos responsáveis</h2>
      </header>
      <p className="mb-3 text-sm text-muted-foreground">Para liberar, gere o relatório em Prontuário → Relatório PDF → Liberar para os responsáveis.</p>
      {data.length === 0 && <p className="text-sm text-muted-foreground">Nenhum relatório liberado.</p>}
      <div className="space-y-2">
        {data.map((r) => (
          <div key={r.id} className="flex flex-wrap items-center gap-2 rounded-xl border p-3">
            <div className="min-w-0 flex-1">
              <div className="font-medium">{r.titulo}</div>
              <div className="text-xs text-muted-foreground">
                {fmtData(r.periodo_de)} a {fmtData(r.periodo_ate)} · liberado por {r.liberado_por_nome ?? "—"} em {fmtData(r.created_at)}
              </div>
            </div>
            <Button size="sm" variant="outline" onClick={() => abrir(r)}>
              <FileDown /> Ver
            </Button>
            {(me.papeis.includes("master") || r.liberado_por === me.id) && (
              <Button size="sm" variant="ghost" onClick={() => revogar(r)}>
                <X /> Retirar
              </Button>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
