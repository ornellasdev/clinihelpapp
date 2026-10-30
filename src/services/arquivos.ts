// Arquivos privados (atestados, documentos, anexos de guia, relatórios): envio validado e abertura só por link temporário.
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { problemaNoArquivo, validadeLinkTemporario, type RegraArquivo } from "@/lib/validacao";
import { ErroServico } from "./resultado";

export const BUCKETS = {
  documentos: "documentos-pacientes",
  guias: "guias-convenio",
  relatorios: "relatorios-familia",
} as const;
export type Bucket = (typeof BUCKETS)[keyof typeof BUCKETS];

/** Validade padrão dos links (segundos); qualquer valor é limitado a 60–300. */
export const VALIDADE_LINK_PADRAO = 120;

export async function linkTemporario(bucket: Bucket, caminho: string, segundos = VALIDADE_LINK_PADRAO): Promise<string> {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(caminho, validadeLinkTemporario(segundos));
  if (error || !data) throw new ErroServico("Não foi possível abrir o arquivo. Ele pode não estar mais disponível para o seu perfil.");
  return data.signedUrl;
}

/** Abre numa nova aba (a aba abre antes do link para o navegador do celular não bloquear). */
export async function abrirArquivoPrivado(bucket: Bucket, caminho: string, segundos?: number) {
  const aba = window.open("", "_blank");
  try {
    const url = await linkTemporario(bucket, caminho, segundos);
    if (aba) {
      aba.opener = null;
      aba.location.href = url;
    } else {
      window.location.assign(url);
    }
  } catch (e) {
    aba?.close();
    toast.error(e instanceof Error ? e.message : "Não foi possível abrir o arquivo.");
  }
}

export const nomeSeguro = (nome: string) => nome.normalize("NFD").replace(/[^\w.-]+/g, "_").slice(-120);

/** Caminho padrão: {clínica}/{pasta}/{prefixo}{aleatório}-{nome}. A primeira pasta é sempre a clínica (regra de acesso). */
export function caminhoArquivo(clinicaId: string | undefined, pasta: string, nome: string, prefixo = "") {
  if (!clinicaId) throw new ErroServico("Clínica não identificada. Entre novamente.");
  return `${clinicaId}/${pasta}/${prefixo}${crypto.randomUUID()}-${nomeSeguro(nome)}`;
}

/** Valida tipo/tamanho e envia. Lança ErroServico com mensagem pronta. */
export async function enviarArquivo(bucket: Bucket, caminho: string, arquivo: File, regra: RegraArquivo) {
  const problema = problemaNoArquivo(arquivo, regra);
  if (problema) throw new ErroServico(problema);
  const { error } = await supabase.storage.from(bucket).upload(caminho, arquivo, { contentType: arquivo.type });
  if (error) throw new ErroServico(`${arquivo.name}: não foi possível enviar o arquivo.`);
}

/**
 * Desfaz um envio que não chegou a ser registrado (ex.: o cadastro falhou).
 * Arquivos já ligados a um registro são preservados pelo banco, mesmo que o registro seja excluído.
 */
export async function desfazerEnvio(bucket: Bucket, caminho: string) {
  await supabase.storage.from(bucket).remove([caminho]);
}
