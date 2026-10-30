import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

/** Número só com dígitos, com DDI 55; vazio se inválido (menos de 10 dígitos com DDD). */
export function numeroWhatsapp(tel: string | null | undefined): string {
  let d = (tel ?? "").replace(/\D/g, "");
  if (d.startsWith("55") && d.length >= 12) d = d.slice(2);
  if (d.length < 10 || d.length > 11) return "";
  return `55${d}`;
}

export function mensagemLembrete(p: {
  responsavel?: string | null;
  crianca: string;
  especialidade?: string | null;
  profissional?: string | null;
  clinica: string;
  inicio: Date;
}): string {
  const primeiro = (p.responsavel ?? "").trim().split(/\s+/)[0];
  const quando = format(p.inicio, "EEEE, dd/MM 'às' HH:mm", { locale: ptBR });
  const atendimento = p.especialidade ? `o atendimento de ${p.especialidade}` : "o atendimento";
  const com = p.profissional ? ` com ${p.profissional}` : "";
  return [
    `Olá${primeiro ? `, ${primeiro}` : ""}! Aqui é da ${p.clinica}.`,
    `Lembrando ${atendimento} de ${p.crianca}${com} ${quando}.`,
    "Por favor, responda *1* para confirmar ou *2* se não puder comparecer.",
  ].join("\n");
}

export function linkWhatsapp(numero: string, texto: string): string {
  return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
}
