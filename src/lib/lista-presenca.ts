// Lista de presença mensal da liminar (PDF), gerada no navegador a partir das sessões realizadas que o usuário já vê.

export type DadosListaPresenca = {
  clinica: string;
  /** yyyy-MM */
  mes: string;
  convenio: string;
  paciente: {
    nome: string;
    data_nascimento: string | null;
    cpf: string | null;
    carteirinha: string | null;
    responsavel_nome: string | null;
    responsavel_cpf: string | null;
  };
  sessoes: { inicio: string; fim: string; especialidade: string; profissional: string; registro: string | null }[];
  nf?: { numero: string; emissao: string; vencimento: string } | null;
};

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const br = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/");
const dois = (n: number) => String(n).padStart(2, "0");
const dataHora = (iso: string) => {
  const d = new Date(iso);
  return { data: `${dois(d.getDate())}/${dois(d.getMonth() + 1)}/${d.getFullYear()}`, hora: `${dois(d.getHours())}:${dois(d.getMinutes())}` };
};

export function nomeMes(mes: string) {
  const [a, m] = mes.split("-");
  return `${MESES[Number(m) - 1]} de ${a}`;
}

export function nomeArquivoLista(paciente: string, mes: string) {
  const slug = paciente
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
  return `lista-presenca-${slug || "paciente"}-${mes}.pdf`;
}

export async function gerarListaPresenca(d: DadosListaPresenca) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 14;
  const L = W - M * 2;

  // Cabeçalho
  doc.setFillColor(15, 40, 80).rect(0, 0, W, 28, "F");
  doc.setTextColor(255, 255, 255).setFont("helvetica", "bold").setFontSize(15);
  doc.text("Lista de Presença", M, 12);
  doc.setFont("helvetica", "normal").setFontSize(10);
  doc.text(d.clinica, M, 19);
  doc.text(`Competência: ${nomeMes(d.mes)}`, M, 24);
  doc.text(d.convenio ? `Liminar · ${d.convenio}` : "Liminar", W - M, 24, { align: "right" });

  // Dados do paciente
  let y = 36;
  doc.setTextColor(20, 20, 20).setFont("helvetica", "bold").setFontSize(12);
  doc.text(d.paciente.nome, M, y);
  y += 5.5;
  doc.setFont("helvetica", "normal").setFontSize(9.5).setTextColor(60, 60, 60);
  const campos = [
    d.paciente.data_nascimento && `Nascimento: ${br(d.paciente.data_nascimento)}`,
    d.paciente.cpf && `CPF: ${d.paciente.cpf}`,
    d.paciente.carteirinha && `Carteirinha: ${d.paciente.carteirinha}`,
    d.paciente.responsavel_nome && `Responsável: ${d.paciente.responsavel_nome}${d.paciente.responsavel_cpf ? ` (CPF ${d.paciente.responsavel_cpf})` : ""}`,
  ].filter(Boolean) as string[];
  for (const linha of doc.splitTextToSize(campos.join("   ·   "), L) as string[]) {
    doc.text(linha, M, y);
    y += 4.8;
  }
  y += 3;

  autoTable(doc, {
    startY: y,
    margin: { left: M, right: M, bottom: 20 },
    head: [["#", "Data", "Horário", "Especialidade", "Profissional", "Assinatura do responsável"]],
    body: d.sessoes.map((s, i) => {
      const a = dataHora(s.inicio);
      const b = dataHora(s.fim);
      return [String(i + 1), a.data, `${a.hora}–${b.hora}`, s.especialidade, s.registro ? `${s.profissional}\n${s.registro}` : s.profissional, ""];
    }),
    styles: { fontSize: 8.5, cellPadding: 2, valign: "middle", minCellHeight: 11, lineColor: [210, 215, 225], lineWidth: 0.2 },
    headStyles: { fillColor: [15, 40, 80], textColor: 255, minCellHeight: 8 },
    columnStyles: {
      0: { cellWidth: 8, halign: "center" },
      1: { cellWidth: 22 },
      2: { cellWidth: 22 },
      3: { cellWidth: 32 },
      4: { cellWidth: 44 },
      5: { cellWidth: "auto" },
    },
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 7;

  // Resumo + assinaturas (mantidos juntos na mesma página)
  if (y + 46 > H - 20) {
    doc.addPage();
    y = M + 4;
  }
  doc.setFont("helvetica", "bold").setFontSize(10).setTextColor(20, 20, 20);
  doc.text(`Total de sessões realizadas no mês: ${d.sessoes.length}`, M, y);
  y += 5.5;
  if (d.nf) {
    doc.setFont("helvetica", "normal").setFontSize(9.5).setTextColor(60, 60, 60);
    doc.text(`Nota fiscal nº ${d.nf.numero} · emitida em ${br(d.nf.emissao)} · vencimento ${br(d.nf.vencimento)}`, M, y);
    y += 5.5;
  }
  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(60, 60, 60);
  doc.text("Declaro que o paciente compareceu às sessões acima relacionadas.", M, y);
  y += 22;
  const metade = (L - 12) / 2;
  doc.setDrawColor(80, 80, 80).setLineWidth(0.3);
  doc.line(M, y, M + metade, y);
  doc.line(M + metade + 12, y, M + L, y);
  doc.setFontSize(8.5);
  doc.text("Responsável legal", M + metade / 2, y + 4.5, { align: "center" });
  doc.text(`${d.clinica} (carimbo e assinatura)`, M + metade + 12 + metade / 2, y + 4.5, { align: "center", maxWidth: metade });

  // Rodapé
  const total = doc.getNumberOfPages();
  const hoje = new Date();
  const gerado = `${dois(hoje.getDate())}/${dois(hoje.getMonth() + 1)}/${hoje.getFullYear()}`;
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal").setFontSize(7.5).setTextColor(130, 130, 130);
    doc.text(`Gerado em ${gerado} pelo CliniHelp`, M, H - 8);
    doc.text(`Página ${i} de ${total}`, W - M, H - 8, { align: "right" });
  }

  doc.save(nomeArquivoLista(d.paciente.nome, d.mes));
}
