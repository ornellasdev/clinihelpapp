import { useMemo, useState } from "react";
import { BookOpen, History, MapPin, Search, Users } from "lucide-react";
import { ARTIGOS, CATEGORIAS, HISTORICO, buscarArtigos, type Categoria } from "@/lib/base-conhecimento/conteudo";
import { Input } from "@/components/ui/input";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { cn } from "@/lib/utils";

export default function BaseConhecimento() {
  const [termo, setTermo] = useState("");
  const [cat, setCat] = useState<Categoria | "todas">("todas");
  const lista = useMemo(() => buscarArtigos(termo).filter((a) => cat === "todas" || a.categoria === cat), [termo, cat]);

  return (
    <div>
      <div>
        <h1 className="text-2xl font-semibold">Base de conhecimento</h1>
        <p className="mt-1 text-sm text-muted-foreground">Como o CliniHelp funciona, para consulta e para tirar dúvidas dos clientes.</p>
      </div>

      <div className="relative mt-5">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={termo} onChange={(e) => setTermo(e.target.value)} placeholder="Buscar (ex.: senha, glosa, liminar, WhatsApp)" className="pl-9" />
      </div>

      <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
        {(["todas", ...CATEGORIAS] as const).map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCat(c)}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1 text-xs font-medium",
              cat === c ? "border-primary bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted",
            )}
          >
            {c === "todas" ? "Todas" : c}
          </button>
        ))}
      </div>

      {lista.length === 0 ? (
        <p className="mt-10 rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">Nada encontrado para “{termo}”.</p>
      ) : (
        <Accordion type="multiple" className="mt-4 grid gap-3">
          {lista.map((a) => (
            <AccordionItem key={a.id} value={a.id} className="rounded-2xl border bg-card px-4 shadow-sm">
              <AccordionTrigger className="text-left hover:no-underline">
                <div className="min-w-0">
                  <div className="text-xs font-medium uppercase tracking-wide text-primary">{a.categoria}</div>
                  <div className="font-semibold">{a.titulo}</div>
                  <div className="mt-0.5 text-sm font-normal text-muted-foreground">{a.resumo}</div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="grid gap-4 text-sm">
                {(a.quemUsa || a.onde) && (
                  <div className="grid gap-1 rounded-lg bg-muted/60 p-3 text-xs">
                    {a.quemUsa && <div className="flex gap-2"><Users className="size-4 shrink-0" /> {a.quemUsa}</div>}
                    {a.onde && <div className="flex gap-2"><MapPin className="size-4 shrink-0" /> {a.onde}</div>}
                  </div>
                )}
                {a.blocos.map((b, i) => (
                  <div key={i}>
                    {b.titulo && <h3 className="mb-1 font-semibold">{b.titulo}</h3>}
                    {b.texto && <p className="text-muted-foreground">{b.texto}</p>}
                    {b.itens && (
                      <ul className="ml-4 list-disc space-y-1 text-muted-foreground">
                        {b.itens.map((t) => <li key={t}>{t}</li>)}
                      </ul>
                    )}
                  </div>
                ))}
                {a.perguntas && a.perguntas.length > 0 && (
                  <div className="grid gap-2">
                    <h3 className="font-semibold">Dúvidas frequentes</h3>
                    {a.perguntas.map((q) => (
                      <div key={q.p} className="rounded-lg border p-3">
                        <p className="font-medium">{q.p}</p>
                        <p className="mt-1 text-muted-foreground">{q.r}</p>
                      </div>
                    ))}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">Atualizado em {a.atualizadoEm.split("-").reverse().join("/")}</p>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}

      <div className="mt-8 rounded-2xl border bg-card p-5">
        <h2 className="flex items-center gap-2 font-semibold"><History className="size-4" /> Últimas mudanças</h2>
        <ul className="mt-3 grid gap-2 text-sm">
          {HISTORICO.map((h) => (
            <li key={h.texto} className="flex gap-3">
              <span className="shrink-0 font-mono text-xs text-muted-foreground">{h.data.split("-").reverse().join("/")}</span>
              <span>{h.texto}</span>
            </li>
          ))}
        </ul>
      </div>
      <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground"><BookOpen className="size-3.5" /> {ARTIGOS.length} artigos</p>
    </div>
  );
}
