// PDF da entrevista inicial (anamnese), gerado no navegador com os dados que o usuário já pode ver.
import type { Tables } from "@/integrations/supabase/types";
import { SECOES_ANAMNESE, campoVisivel, textoDaResposta, type Respostas } from "./anamnese";

type Parecer = Pick<Tables<"anamnese_pareceres">, "encaminhamentos" | "condutas" | "profissional_nome" | "profissional_registro" | "created_at"> & {
  especialidade: string;
};

const dataHora = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });

export async function gerarPdfAnamnese(d: { clinica: string; paciente: string; anamnese: Tables<"anamneses">; pareceres: Parecer[] }) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 16;
  const L = W - M * 2;
  let y = M;
  const garantir = (altura: number) => {
    if (y + altura > H - 18) {
      doc.addPage();
      y = M;
    }
  };
  const fimTabela = () => (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

  doc.setFillColor(15, 40, 80).rect(0, 0, W, 30, "F");
  doc.setTextColor(255, 255, 255).setFont("helvetica", "bold").setFontSize(15);
  doc.text("Entrevista inicial com pais e responsáveis", M, 13);
  doc.setFont("helvetica", "normal").setFontSize(10);
  doc.text("Anamnese e levantamento das necessidades terapêuticas da criança", M, 19);
  doc.text(d.clinica, M, 25);
  y = 40;

  doc.setTextColor(20, 20, 20).setFont("helvetica", "bold").setFontSize(12);
  doc.text(d.paciente, M, y);
  y += 5.5;
  doc.setFont("helvetica", "normal").setFontSize(9.5).setTextColor(70, 70, 70);
  const especialidades = [...new Set(d.pareceres.map((p) => p.especialidade))].join(", ");
  const info = [
    `Data da entrevista: ${dataHora(d.anamnese.created_at)}`,
    d.pareceres[0] ? `Profissional responsável: ${d.pareceres[0].profissional_nome ?? "—"}` : null,
    especialidades ? `Especialidade: ${especialidades}` : null,
  ].filter(Boolean) as string[];
  for (const linha of doc.splitTextToSize(info.join("   ·   "), L) as string[]) {
    doc.text(linha, M, y);
    y += 5;
  }
  y += 3;

  const r = d.anamnese.respostas as Respostas;
  for (const s of SECOES_ANAMNESE) {
    garantir(20);
    autoTable(doc, {
      startY: y,
      margin: { left: M, right: M },
      head: [[{ content: s.titulo, colSpan: 2 }]],
      body: s.campos
        .filter((c) => campoVisivel(c, r))
        .map((c) => [c.grupo ? `${c.grupo} — ${c.rotulo}` : c.rotulo, textoDaResposta(c, r[c.id])]),
      styles: { fontSize: 8.5, cellPadding: 1.8, valign: "top" },
      headStyles: { fillColor: [15, 40, 80] },
      columnStyles: { 0: { cellWidth: 72, textColor: [80, 80, 80] } },
    });
    y = fimTabela() + 5;
  }

  if (d.pareceres.length) {
    garantir(20);
    autoTable(doc, {
      startY: y,
      margin: { left: M, right: M },
      head: [[{ content: "Parecer do profissional", colSpan: 2 }]],
      body: d.pareceres.flatMap((p) => [
        [
          { content: `${p.especialidade} · ${p.profissional_nome ?? ""}${p.profissional_registro ? ` · ${p.profissional_registro}` : ""} · ${dataHora(p.created_at)}`, colSpan: 2, styles: { fontStyle: "bold" as const } },
        ],
        ["Encaminhamentos ou avaliações complementares", p.encaminhamentos],
        ["Condutas iniciais e próximos passos", p.condutas],
      ]),
      styles: { fontSize: 8.5, cellPadding: 1.8, valign: "top" },
      headStyles: { fillColor: [20, 150, 140] },
      columnStyles: { 0: { cellWidth: 72, textColor: [80, 80, 80] } },
    });
    y = fimTabela() + 6;
  }

  garantir(34);
  doc.setFont("helvetica", "bold").setFontSize(10).setTextColor(20, 20, 20);
  doc.text("Assinaturas eletrônicas", M, y);
  y += 5;
  doc.setFont("helvetica", "normal").setFontSize(8.5).setTextColor(60, 60, 60);
  const linhas = [
    `Responsável: ${d.anamnese.preenchido_por_nome} (${d.anamnese.preenchido_por_parentesco})${d.anamnese.preenchido_por_email ? ` · ${d.anamnese.preenchido_por_email}` : ""} · ${dataHora(d.anamnese.created_at)} — declarou a veracidade das informações e a ciência do tratamento dos dados conforme a LGPD.`,
    ...d.pareceres.map((p) => `Profissional: ${p.profissional_nome ?? ""}${p.profissional_registro ? ` (${p.profissional_registro})` : ""} · ${dataHora(p.created_at)}`),
    `Comprovante: ${d.anamnese.comprovante_hash}`,
  ];
  for (const l of linhas) {
    for (const t of doc.splitTextToSize(l, L) as string[]) {
      garantir(5);
      doc.text(t, M, y);
      y += 4.2;
    }
    y += 1;
  }

  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5).setTextColor(130, 130, 130);
    doc.text(`Documento confidencial — dados de saúde (LGPD art. 11 e 14) · ${d.clinica}`, M, H - 8);
    doc.text(`${i}/${total}`, W - M, H - 8, { align: "right" });
  }
  const slug = d.paciente.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase();
  doc.save(`entrevista-inicial-${slug || "paciente"}.pdf`);
}
