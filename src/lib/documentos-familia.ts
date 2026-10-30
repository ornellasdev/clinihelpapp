// PDFs da família gerados no navegador: comprovante de termo assinado e recibo de pagamento.
import { ROTULO_DECISAO, TIPOS_TERMO, formatarCpf, type Decisao, type TipoTermo } from "./familia";

const dataHora = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "medium" });
const moeda = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export type ComprovanteTermo = {
  clinica: string;
  paciente: string;
  titulo: string;
  tipo: string;
  texto: string;
  texto_hash: string;
  assinado_em: string | null;
  assinante_nome: string | null;
  assinante_cpf: string | null;
  assinante_email: string | null;
  assinante_parentesco: string | null;
  decisao: string | null;
  assinatura_imagem: string | null;
  ip: string | null;
  user_agent: string | null;
  comprovante_hash: string | null;
};

export async function baixarComprovanteTermo(t: ComprovanteTermo) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 18;
  const L = W - M * 2;
  let y = M;
  const garantir = (h: number) => {
    if (y + h > H - 16) {
      doc.addPage();
      y = M;
    }
  };

  doc.setFillColor(15, 40, 80).rect(0, 0, W, 26, "F");
  doc.setTextColor(255, 255, 255).setFont("helvetica", "bold").setFontSize(14).text(t.titulo, M, 12);
  doc.setFont("helvetica", "normal").setFontSize(9.5).text(`${t.clinica} · ${TIPOS_TERMO[t.tipo as TipoTermo] ?? ""}`, M, 19);
  y = 36;
  doc.setTextColor(20, 20, 20).setFont("helvetica", "bold").setFontSize(10.5).text(`Criança: ${t.paciente}`, M, y);
  y += 8;
  doc.setFont("helvetica", "normal").setFontSize(10);
  for (const linha of doc.splitTextToSize(t.texto, L) as string[]) {
    garantir(5);
    doc.text(linha, M, y);
    y += 5;
  }

  garantir(70);
  y += 6;
  doc.setDrawColor(20, 150, 140).setLineWidth(0.6).line(M, y, M + L, y);
  y += 7;
  doc.setFont("helvetica", "bold").setFontSize(11).text(`Decisão: ${ROTULO_DECISAO[t.decisao as Decisao] ?? "—"}`, M, y);
  y += 4;
  if (t.assinatura_imagem) {
    doc.addImage(t.assinatura_imagem, "PNG", M, y, 70, 26);
    y += 27;
  }
  doc.setDrawColor(120, 120, 120).setLineWidth(0.3).line(M, y, M + 80, y);
  y += 5;
  doc.setFont("helvetica", "normal").setFontSize(10);
  doc.text(`${t.assinante_nome ?? ""} — CPF ${formatarCpf(t.assinante_cpf ?? "")}`, M, y);
  y += 5;
  doc.text(`${t.assinante_parentesco ?? ""} · ${t.assinante_email ?? ""}`, M, y);
  y += 9;

  garantir(34);
  doc.setFillColor(243, 246, 250).rect(M, y, L, 32, "F");
  doc.setFontSize(8).setTextColor(70, 70, 70);
  const meta = [
    "Assinatura eletrônica simples (Lei nº 14.063/2020), feita na Área da família do CliniHelp, com acesso por código enviado ao e-mail do responsável.",
    `Assinado em: ${t.assinado_em ? dataHora(t.assinado_em) : "—"} (horário de Brasília)   ·   IP: ${t.ip ?? "—"}`,
    `Aparelho: ${(t.user_agent ?? "—").slice(0, 120)}`,
    `Impressão digital do texto (SHA-256): ${t.texto_hash}`,
    `Código do comprovante: ${t.comprovante_hash ?? "—"}`,
  ];
  let my = y + 5;
  for (const m of meta)
    for (const l of doc.splitTextToSize(m, L - 6) as string[]) {
      doc.text(l, M + 3, my);
      my += 3.8;
    }

  const slug = t.paciente.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase();
  doc.save(`termo-${t.tipo}-${slug}.pdf`);
}

export type DadosRecibo = {
  clinica: string;
  paciente: string;
  descricao: string;
  valor: number;
  pago_em: string;
  pagador_nome: string;
  pagador_cpf: string;
  forma: string;
  id: string;
};

export async function baixarRecibo(r: DadosRecibo) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a5", orientation: "landscape" });
  const W = doc.internal.pageSize.getWidth();
  const M = 14;
  doc.setFillColor(15, 40, 80).rect(0, 0, W, 22, "F");
  doc.setTextColor(255, 255, 255).setFont("helvetica", "bold").setFontSize(15).text("RECIBO", M, 14);
  doc.setFontSize(13).text(moeda(r.valor), W - M, 14, { align: "right" });
  doc.setTextColor(25, 25, 25).setFont("helvetica", "normal").setFontSize(10.5);
  const texto = `Recebemos de ${r.pagador_nome}${r.pagador_cpf ? `, CPF ${formatarCpf(r.pagador_cpf)}` : ""}, a importância de ${moeda(r.valor)}, referente a ${r.descricao}, do(a) paciente ${r.paciente}.`;
  let y = 34;
  for (const l of doc.splitTextToSize(texto, W - M * 2) as string[]) {
    doc.text(l, M, y);
    y += 6;
  }
  y += 4;
  doc.setFontSize(9.5).setTextColor(80, 80, 80);
  doc.text(`Pagamento confirmado em ${dataHora(r.pago_em)} · forma: ${r.forma}`, M, y);
  y += 14;
  doc.setDrawColor(150, 150, 150).line(M, y, M + 80, y);
  doc.setTextColor(25, 25, 25).setFontSize(10.5).text(r.clinica, M, y + 5);
  doc.setFontSize(7.5).setTextColor(130, 130, 130).text(`Recibo gerado pelo CliniHelp · código ${r.id}`, M, doc.internal.pageSize.getHeight() - 8);
  doc.save(`recibo-${r.pago_em.slice(0, 10)}.pdf`);
}
