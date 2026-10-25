import { calcularRepasse } from "./financeiro";

export type LinhaFinanceiraOrigem = {
  inicio: string;
  status: string;
  paciente?: { nome: string } | null;
  profissional?: { nome: string } | null;
  especialidade?: { nome: string } | null;
  fin?: { valor: number | string; percentual_repasse: number | string; pagamento_status: string; repasse_pago: boolean } | null;
};

export type LinhaExportacao = {
  data: string;
  hora: string;
  paciente: string;
  especialidade: string;
  profissional: string;
  status: string;
  valor: number;
  percentual: number;
  repasse: number;
  liquido: number;
  pagoPaciente: string;
  repassePago: string;
};

export const COLUNAS: { chave: keyof LinhaExportacao; titulo: string; moeda?: boolean }[] = [
  { chave: "data", titulo: "Data" },
  { chave: "hora", titulo: "Hora" },
  { chave: "paciente", titulo: "Paciente" },
  { chave: "especialidade", titulo: "Especialidade" },
  { chave: "profissional", titulo: "Profissional" },
  { chave: "status", titulo: "Status" },
  { chave: "valor", titulo: "Valor (R$)", moeda: true },
  { chave: "percentual", titulo: "Repasse %" },
  { chave: "repasse", titulo: "Repasse (R$)", moeda: true },
  { chave: "liquido", titulo: "Líquido clínica (R$)", moeda: true },
  { chave: "pagoPaciente", titulo: "Pago pelo paciente" },
  { chave: "repassePago", titulo: "Repasse pago" },
];

const pad = (n: number) => String(n).padStart(2, "0");

export function montarLinhas(linhas: LinhaFinanceiraOrigem[], rotuloStatus: (s: string) => string): LinhaExportacao[] {
  return linhas.map((l) => {
    const d = new Date(l.inicio);
    const valor = Number(l.fin?.valor ?? 0);
    const percentual = Number(l.fin?.percentual_repasse ?? 0);
    const repasse = calcularRepasse(valor, percentual);
    return {
      data: `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`,
      hora: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
      paciente: l.paciente?.nome ?? "",
      especialidade: l.especialidade?.nome ?? "",
      profissional: l.profissional?.nome ?? "",
      status: rotuloStatus(l.status),
      valor,
      percentual,
      repasse,
      liquido: Math.round((valor - repasse) * 100) / 100,
      pagoPaciente: l.fin?.pagamento_status === "pago" ? "Sim" : "Não",
      repassePago: l.fin?.repasse_pago ? "Sim" : "Não",
    };
  });
}

export function totalizar(linhas: LinhaExportacao[]) {
  const soma = (k: "valor" | "repasse" | "liquido") => Math.round(linhas.reduce((s, l) => s + l[k], 0) * 100) / 100;
  return { valor: soma("valor"), repasse: soma("repasse"), liquido: soma("liquido") };
}

const numBR = (n: number) => n.toFixed(2).replace(".", ",");

/** CSV no padrão brasileiro: separador ";" e vírgula decimal, para abrir direto no Excel. */
export function gerarCsv(linhas: LinhaExportacao[]): string {
  const esc = (v: string) => (/[";\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const cab = COLUNAS.map((c) => esc(c.titulo)).join(";");
  const corpo = linhas.map((l) =>
    COLUNAS.map((c) => {
      const v = l[c.chave];
      return typeof v === "number" ? numBR(v) : esc(v);
    }).join(";"),
  );
  return "\uFEFF" + [cab, ...corpo].join("\r\n");
}

function baixar(blob: Blob, nome: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export function exportarCsv(linhas: LinhaExportacao[], nomeBase: string) {
  baixar(new Blob([gerarCsv(linhas)], { type: "text/csv;charset=utf-8" }), `${nomeBase}.csv`);
}

export async function exportarXlsx(linhas: LinhaExportacao[], nomeBase: string, titulo: string) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "CliniHelp";
  const ws = wb.addWorksheet("Financeiro");
  ws.addRow([titulo]).font = { bold: true, size: 14, name: "Arial" };
  ws.addRow([]);
  const cab = ws.addRow(COLUNAS.map((c) => c.titulo));
  cab.font = { bold: true, color: { argb: "FFFFFFFF" }, name: "Arial" };
  cab.eachCell((c) => (c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0B2545" } }));
  const primeira = ws.rowCount + 1;
  for (const l of linhas) ws.addRow(COLUNAS.map((c) => (c.chave === "percentual" ? l.percentual / 100 : l[c.chave])));
  const ultima = ws.rowCount;
  const letra = (k: keyof LinhaExportacao) => String.fromCharCode(65 + COLUNAS.findIndex((c) => c.chave === k));
  const total = ws.addRow(
    COLUNAS.map((c) =>
      c.chave === "data"
        ? "Total"
        : c.moeda && linhas.length
          ? { formula: `SUM(${letra(c.chave)}${primeira}:${letra(c.chave)}${ultima})` }
          : c.moeda
            ? 0
            : "",
    ),
  );
  total.font = { bold: true, name: "Arial" };
  COLUNAS.forEach((c, i) => {
    const col = ws.getColumn(i + 1);
    col.width = c.chave === "paciente" || c.chave === "profissional" ? 28 : c.chave === "especialidade" ? 20 : 15;
    if (c.moeda) col.numFmt = '"R$" #,##0.00;-"R$" #,##0.00;"-"';
    if (c.chave === "percentual") col.numFmt = "0.0%";
  });
  const buf = await wb.xlsx.writeBuffer();
  baixar(
    new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    `${nomeBase}.xlsx`,
  );
}

export async function exportarPdf(linhas: LinhaExportacao[], nomeBase: string, titulo: string, subtitulo: string) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
  doc.setFontSize(16);
  doc.text(titulo, 14, 16);
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(subtitulo, 14, 22);
  const t = totalizar(linhas);
  autoTable(doc, {
    startY: 28,
    head: [COLUNAS.map((c) => c.titulo)],
    body: linhas.map((l) =>
      COLUNAS.map((c) => {
        const v = l[c.chave];
        if (c.moeda) return brl.format(v as number);
        if (c.chave === "percentual") return `${String(v).replace(".", ",")}%`;
        return String(v);
      }),
    ),
    foot: [
      COLUNAS.map((c) =>
        c.chave === "data" ? "Total" : c.chave === "valor" ? brl.format(t.valor) : c.chave === "repasse" ? brl.format(t.repasse) : c.chave === "liquido" ? brl.format(t.liquido) : "",
      ),
    ],
    styles: { fontSize: 8, cellPadding: 1.8 },
    headStyles: { fillColor: [11, 37, 69] },
    footStyles: { fillColor: [230, 240, 245], textColor: 20, fontStyle: "bold" },
    columnStyles: Object.fromEntries(
      COLUNAS.map((c, i) => [i, c.moeda || c.chave === "percentual" ? { halign: "right" as const } : {}]),
    ),
  });
  doc.save(`${nomeBase}.pdf`);
}
