import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CheckCircle2, Download, FileUp, Loader2, TriangleAlert } from "lucide-react";
import { listarClinicas } from "@/lib/dev.functions";
import { importarDados } from "@/lib/migracao.functions";
import { lerCsv, modeloCsv, validarPlanilha, type LinhaValidada, type TipoMigracao } from "@/lib/migracao";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

const TIPOS: { k: TipoMigracao; rotulo: string; dica: string }[] = [
  { k: "convenios", rotulo: "Convênios", dica: "Importe primeiro, para os pacientes já ficarem ligados ao convênio." },
  { k: "pacientes", rotulo: "Pacientes e responsáveis", dica: "Só dados de cadastro. Diagnóstico e prontuário antigo entram como documento na ficha." },
];

export default function MigracaoDados() {
  const listar = useServerFn(listarClinicas);
  const importar = useServerFn(importarDados);
  const { data: clinicas = [] } = useQuery({ queryKey: ["dev-clinicas"], queryFn: () => listar() });
  const [clinicaId, setClinicaId] = useState("");
  const [tipo, setTipo] = useState<TipoMigracao>("convenios");
  const [arquivo, setArquivo] = useState<{ nome: string; texto: string } | null>(null);
  const [linhas, setLinhas] = useState<LinhaValidada[]>([]);
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<string | null>(null);

  function limpar() { setArquivo(null); setLinhas([]); setErroGeral(null); setResultado(null); }

  function baixarModelo(t: TipoMigracao) {
    const url = URL.createObjectURL(new Blob([modeloCsv(t)], { type: "text/csv;charset=utf-8" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: `modelo-${t}.csv` });
    a.click();
    URL.revokeObjectURL(url);
  }

  async function escolher(f: File | undefined) {
    limpar();
    if (!f) return;
    if (f.size > 5_000_000) return setErroGeral("Arquivo maior que 5 MB. Divida em partes.");
    const texto = await f.text();
    const r = validarPlanilha(tipo, lerCsv(texto));
    setArquivo({ nome: f.name, texto });
    setLinhas(r.linhas);
    setErroGeral(r.erroGeral ?? null);
  }

  const erros = linhas.filter((l) => l.erros.length);
  const pronto = clinicaId && arquivo && !erroGeral && linhas.length > 0 && erros.length === 0;
  const clinica = clinicas.find((c) => c.id === clinicaId);

  async function confirmar() {
    if (!pronto || !arquivo) return;
    if (!confirm(`Importar ${linhas.length} registro(s) de ${tipo} para ${clinica?.nome}?`)) return;
    setEnviando(true);
    try {
      const r = await importar({ data: { clinicaId, tipo, conteudo: arquivo.texto } });
      setResultado(`${r.inseridos} importado(s) em ${r.clinica}. ${r.ignorados} já existia(m) e foram ignorados.`);
      setArquivo(null); setLinhas([]);
      toast.success("Importação concluída");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha na importação");
    } finally {
      setEnviando(false);
    }
  }

  const colunasPrevia = tipo === "convenios" ? ["nome", "tipo"] : ["nome", "data_nascimento", "convenio", "responsavel_nome", "responsavel_telefone"];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Migração de dados</h1>
        <p className="text-sm text-muted-foreground">Traga a base de um cliente novo. Nada é gravado até você confirmar, e registros repetidos são ignorados.</p>
      </div>

      <section className="rounded-xl border bg-card p-4 space-y-3">
        <h2 className="font-medium">1. Baixe o modelo e preencha</h2>
        <p className="text-sm text-muted-foreground">Abra no Excel, cole os dados do sistema antigo nas colunas e salve como CSV. Datas em DD/MM/AAAA.</p>
        <div className="flex flex-wrap gap-2">
          {TIPOS.map((t) => (
            <Button key={t.k} variant="outline" size="sm" onClick={() => baixarModelo(t.k)}>
              <Download className="size-4" /> Modelo {t.rotulo}
            </Button>
          ))}
        </div>
      </section>

      <section className="rounded-xl border bg-card p-4 space-y-4">
        <h2 className="font-medium">2. Escolha a clínica e o arquivo</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="mig-clinica">Clínica de destino</Label>
            <select id="mig-clinica" value={clinicaId} onChange={(e) => { setClinicaId(e.target.value); setResultado(null); }}
              className="h-10 w-full rounded-md border bg-background px-3 text-sm">
              <option value="">Selecione…</option>
              {clinicas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mig-tipo">O que importar</Label>
            <select id="mig-tipo" value={tipo} onChange={(e) => { setTipo(e.target.value as TipoMigracao); limpar(); }}
              className="h-10 w-full rounded-md border bg-background px-3 text-sm">
              {TIPOS.map((t) => <option key={t.k} value={t.k}>{t.rotulo}</option>)}
            </select>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">{TIPOS.find((t) => t.k === tipo)?.dica}</p>
        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed p-6 text-sm text-muted-foreground hover:bg-muted">
          <FileUp className="size-5" /> {arquivo ? arquivo.nome : "Selecionar arquivo CSV"}
          <input type="file" accept=".csv,text/csv" className="sr-only" key={arquivo?.nome ?? "vazio"}
            onChange={(e) => escolher(e.target.files?.[0])} />
        </label>
      </section>

      {erroGeral && <p className="flex items-center gap-2 text-sm text-destructive"><TriangleAlert className="size-4" /> {erroGeral}</p>}
      {resultado && <p className="flex items-center gap-2 rounded-lg border bg-card p-3 text-sm"><CheckCircle2 className="size-4 text-primary" /> {resultado}</p>}

      {linhas.length > 0 && (
        <section className="rounded-xl border bg-card p-4 space-y-3">
          <h2 className="font-medium">3. Confira</h2>
          <p className="text-sm">
            <strong>{linhas.length - erros.length}</strong> prontas ·{" "}
            <strong className={erros.length ? "text-destructive" : ""}>{erros.length}</strong> com erro
          </p>
          {erros.length > 0 && (
            <ul className="max-h-48 overflow-auto rounded-md border bg-destructive/5 p-3 text-sm text-destructive space-y-1">
              {erros.slice(0, 100).map((l) => <li key={l.linha}>Linha {l.linha} ({l.dados["nome"] ?? "sem nome"}): {l.erros.join(" ")}</li>)}
            </ul>
          )}
          <div className="max-h-80 overflow-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted text-left"><tr><th className="p-2">Linha</th>{colunasPrevia.map((c) => <th key={c} className="p-2">{c}</th>)}</tr></thead>
              <tbody>
                {linhas.slice(0, 50).map((l) => (
                  <tr key={l.linha} className={l.erros.length ? "bg-destructive/10" : "border-t"}>
                    <td className="p-2">{l.linha}</td>
                    {colunasPrevia.map((c) => <td key={c} className="p-2">{l.dados[c] ?? "—"}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {linhas.length > 50 && <p className="text-xs text-muted-foreground">Mostrando 50 de {linhas.length}.</p>}
          <Button disabled={!pronto || enviando} onClick={confirmar}>
            {enviando && <Loader2 className="size-4 animate-spin" />}
            {!clinicaId ? "Escolha a clínica" : erros.length ? "Corrija os erros" : `Confirmar importação (${linhas.length})`}
          </Button>
        </section>
      )}
    </div>
  );
}
