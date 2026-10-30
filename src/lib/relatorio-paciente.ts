// Relatório do paciente em PDF, gerado no navegador a partir dos dados que o usuário já pode ver.
import { evolucoesDoPeriodo, resumoDaMeta, rotuloNivel, serieDaMeta, STATUS_META, type RegistroProgresso, type StatusMeta } from "./plano-terapeutico";

export type DadosRelatorio = {
  clinica: string;
  finalidade: string;
  paciente: { nome: string; data_nascimento: string | null; diagnostico: string | null };
  de: string;
  ate: string;
  especialidades: { id: string; nome: string }[];
  evolucoes: {
    data_atendimento: string;
    especialidade_id: string;
    conteudo: string;
    profissional_nome: string | null;
    profissional_registro: string | null;
  }[];
  metas: { id: string; especialidade_id: string; titulo: string; descricao: string | null; status: string }[];
  progresso: RegistroProgresso[];
  incluirMetas: boolean;
  incluirEvolucoes: boolean;
};

const br = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/");
const CORES: [number, number, number][] = [
  [37, 99, 175],
  [20, 150, 140],
  [120, 80, 180],
  [210, 100, 60],
  [190, 150, 30],
  [90, 90, 90],
];

export function nomeArquivoRelatorio(paciente: string, de: string, ate: string) {
  const slug = paciente
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
  return `relatorio-${slug || "paciente"}-${de}-a-${ate}.pdf`;
}

export async function gerarRelatorioPaciente(d: DadosRelatorio, modo: "baixar" | "arquivo" = "baixar") {
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
  const titulo = (t: string) => {
    garantir(14);
    doc.setFont("helvetica", "bold").setFontSize(13).setTextColor(15, 40, 80);
    doc.text(t, M, y);
    y += 2;
    doc.setDrawColor(20, 150, 140).setLineWidth(0.6).line(M, y, M + L, y);
    y += 6;
  };

  // Cabeçalho
  doc.setFillColor(15, 40, 80).rect(0, 0, W, 30, "F");
  doc.setTextColor(255, 255, 255).setFont("helvetica", "bold").setFontSize(16);
  doc.text("Relatório de evolução terapêutica", M, 13);
  doc.setFont("helvetica", "normal").setFontSize(10);
  doc.text(d.clinica, M, 20);
  doc.text(`Período: ${br(d.de)} a ${br(d.ate)}`, M, 25);
  if (d.finalidade) doc.text(`Finalidade: ${d.finalidade}`, W - M, 25, { align: "right" });
  y = 40;

  doc.setTextColor(20, 20, 20).setFont("helvetica", "bold").setFontSize(12);
  doc.text(d.paciente.nome, M, y);
  y += 5.5;
  doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(70, 70, 70);
  const info = [
    d.paciente.data_nascimento ? `Nascimento: ${br(d.paciente.data_nascimento)}` : null,
    d.paciente.diagnostico ? `Diagnóstico: ${d.paciente.diagnostico}` : null,
    `Especialidades: ${d.especialidades.map((e) => e.nome).join(", ")}`,
  ].filter(Boolean) as string[];
  for (const linha of doc.splitTextToSize(info.join("   ·   "), L) as string[]) {
    doc.text(linha, M, y);
    y += 5;
  }
  y += 4;

  const idsEsp = d.especialidades.map((e) => e.id);
  const evs = evolucoesDoPeriodo(d.evolucoes, d.de, d.ate, idsEsp);
  const progressoPeriodo = d.progresso.filter((p) => p.data >= d.de && p.data <= d.ate);

  if (d.incluirMetas) {
    titulo("Plano terapêutico e progresso das metas");
    doc.setFont("helvetica", "normal").setFontSize(8.5).setTextColor(90, 90, 90);
    doc.text("Escala por sessão: 1 Não realizou · 2 Com ajuda total · 3 Com ajuda parcial · 4 Com pouca ajuda · 5 Independente", M, y);
    y += 6;
    let algum = false;
    for (const esp of d.especialidades) {
      const metas = d.metas.filter((m) => m.especialidade_id === esp.id);
      if (!metas.length) continue;
      algum = true;
      garantir(30);
      doc.setFont("helvetica", "bold").setFontSize(11).setTextColor(20, 20, 20);
      doc.text(esp.nome, M, y);
      y += 3;
      autoTable(doc, {
        startY: y,
        margin: { left: M, right: M },
        head: [["Meta", "Situação", "Sessões", "Inicial", "Atual"]],
        body: metas.map((m) => {
          const r = resumoDaMeta(m.id, progressoPeriodo);
          return [
            m.descricao ? `${m.titulo}\n${m.descricao}` : m.titulo,
            STATUS_META[m.status as StatusMeta] ?? m.status,
            String(r.sessoes),
            r.inicial === null ? "—" : `${r.inicial} · ${rotuloNivel(Math.round(r.inicial))}`,
            r.atual === null ? "—" : `${r.atual} · ${rotuloNivel(Math.round(r.atual))}`,
          ];
        }),
        styles: { fontSize: 8.5, cellPadding: 1.8 },
        headStyles: { fillColor: [15, 40, 80] },
        columnStyles: { 0: { cellWidth: 70 }, 2: { halign: "center" } },
      });
      y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4;

      const series = metas
        .map((m, i) => ({ m, cor: CORES[i % CORES.length]!, pts: serieDaMeta(m.id, progressoPeriodo) }))
        .filter((s) => s.pts.length > 0);
      if (series.length) {
        const gh = 46;
        garantir(gh + 8 + series.length * 4.5);
        const gx = M + 8;
        const gw = L - 8;
        const datas = [...new Set(series.flatMap((s) => s.pts.map((p) => p.data)))].sort();
        const xDe = (dt: string) => (datas.length === 1 ? gx + gw / 2 : gx + (datas.indexOf(dt) / (datas.length - 1)) * gw);
        const yDe = (n: number) => y + gh - ((n - 1) / 4) * gh;
        doc.setDrawColor(225, 225, 225).setLineWidth(0.2);
        doc.setFont("helvetica", "normal").setFontSize(7).setTextColor(120, 120, 120);
        for (let n = 1; n <= 5; n++) {
          doc.line(gx, yDe(n), gx + gw, yDe(n));
          doc.text(String(n), M + 4, yDe(n) + 1);
        }
        doc.text(br(datas[0]!), gx, y + gh + 4);
        if (datas.length > 1) doc.text(br(datas[datas.length - 1]!), gx + gw, y + gh + 4, { align: "right" });
        for (const s of series) {
          doc.setDrawColor(...s.cor).setFillColor(...s.cor).setLineWidth(0.7);
          s.pts.forEach((p, i) => {
            const px = xDe(p.data);
            const py = yDe(p.nivel);
            if (i > 0) doc.line(xDe(s.pts[i - 1]!.data), yDe(s.pts[i - 1]!.nivel), px, py);
            doc.circle(px, py, 0.8, "F");
          });
        }
        y += gh + 8;
        doc.setFontSize(8);
        for (const s of series) {
          doc.setFillColor(...s.cor).rect(M + 8, y - 2.2, 3, 3, "F");
          doc.setTextColor(60, 60, 60).text(doc.splitTextToSize(s.m.titulo, L - 16)[0] as string, M + 13, y);
          y += 4.5;
        }
        y += 4;
      }
    }
    if (!algum) {
      doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(90, 90, 90);
      doc.text("Nenhuma meta cadastrada para as especialidades escolhidas.", M, y);
      y += 8;
    }
  }

  if (d.incluirEvolucoes) {
    titulo(`Evoluções (${evs.length})`);
    if (!evs.length) {
      doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(90, 90, 90);
      doc.text("Nenhuma evolução no período.", M, y);
      y += 8;
    }
    const nomeEsp = Object.fromEntries(d.especialidades.map((e) => [e.id, e.nome]));
    for (const e of evs) {
      garantir(20);
      doc.setFont("helvetica", "bold").setFontSize(10.5).setTextColor(15, 40, 80);
      doc.text(`${br(e.data_atendimento)} · ${nomeEsp[e.especialidade_id] ?? ""}`, M, y);
      y += 5.5;
      doc.setFont("helvetica", "normal").setFontSize(9.5).setTextColor(30, 30, 30);
      for (const linha of doc.splitTextToSize(e.conteudo, L) as string[]) {
        garantir(5);
        doc.text(linha, M, y);
        y += 4.6;
      }
      garantir(8);
      y += 1;
      doc.setFontSize(8.5).setTextColor(100, 100, 100);
      doc.text(`${e.profissional_nome ?? ""}${e.profissional_registro ? ` — ${e.profissional_registro}` : ""}`, M, y);
      y += 3;
      doc.setDrawColor(230, 230, 230).setLineWidth(0.2).line(M, y, M + L, y);
      y += 6;
    }
  }

  // Rodapé em todas as páginas
  const total = doc.getNumberOfPages();
  const hoje = new Date();
  const gerado = `${String(hoje.getDate()).padStart(2, "0")}/${String(hoje.getMonth() + 1).padStart(2, "0")}/${hoje.getFullYear()}`;
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal").setFontSize(7.5).setTextColor(130, 130, 130);
    doc.text(`Documento sigiloso com dados de saúde · gerado em ${gerado} pelo CliniHelp`, M, H - 8);
    doc.text(`Página ${i} de ${total}`, W - M, H - 8, { align: "right" });
  }

  const nome = nomeArquivoRelatorio(d.paciente.nome, d.de, d.ate);
  if (modo === "arquivo") return { evolucoes: evs.length, nome, arquivo: doc.output("blob") };
  doc.save(nome);
  return { evolucoes: evs.length, nome, arquivo: null };
}
