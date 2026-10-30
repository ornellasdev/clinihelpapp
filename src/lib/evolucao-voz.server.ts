// Evolução por voz: transcreve o áudio e organiza o texto clínico (somente no servidor).
import { createOpenAI } from "@ai-sdk/openai";
import { streamText } from "ai";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { createLovableAiGatewayRunIdFetch } from "./ai-run-id.server";

const GATEWAY = "https://ai.gateway.lovable.dev";
const MODELO_TRANSCRICAO = "openai/gpt-transcribe";
const MODELO_TEXTO = "openai/gpt-6-astra";
/** Limite do arquivo (o gateway aceita até 25 MiB por pedido; folga para o restante do formulário). */
export const MAX_AUDIO_BYTES = 24 * 1024 * 1024;

class ErroHttp extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

/** Confere a sessão e se o profissional pertence à especialidade (mesma regra de quem escreve evolução). */
async function autorizar(request: Request, especialidadeId: string) {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) throw new ErroHttp(500, "Servidor sem configuração do banco.");
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) throw new ErroHttp(401, "Sessão expirada. Entre novamente.");
  const sb = createClient<Database>(url, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    global: {
      headers: { Authorization: `Bearer ${token}` },
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
  const { data: u, error } = await sb.auth.getUser(token);
  if (error || !u.user) throw new ErroHttp(401, "Sessão expirada. Entre novamente.");
  const { data: pode } = await sb.rpc("has_especialidade", { _user_id: u.user.id, _esp: especialidadeId });
  if (!pode) throw new ErroHttp(403, "Você não está vinculado a essa especialidade.");
  const { data: esp } = await sb.from("especialidades").select("nome").eq("id", especialidadeId).maybeSingle();
  return { especialidade: esp?.nome ?? "" };
}

function erroDoGateway(status: number, corpo: string) {
  let msg = "";
  try {
    const j = JSON.parse(corpo) as { error?: { message?: string }; message?: string };
    msg = j.error?.message ?? j.message ?? "";
  } catch {
    /* corpo não é JSON */
  }
  if (status === 402) return new ErroHttp(402, msg || "Créditos de IA esgotados. Fale com o responsável pelo sistema.");
  if (status === 429) return new ErroHttp(429, "Muitos pedidos agora. Aguarde um minuto e tente de novo.");
  if (status === 400) return new ErroHttp(400, "Não foi possível entender o áudio. Grave novamente, mais perto do microfone.");
  if (status === 403) return new ErroHttp(403, msg || "A inteligência artificial está bloqueada para esta conta.");
  return new ErroHttp(status >= 500 ? 502 : status, msg || "Falha ao transcrever o áudio.");
}

/** Transcreve com streaming e devolve o texto final. */
async function transcrever(apiKey: string, arquivo: File, signal: AbortSignal) {
  const form = new FormData();
  form.append("model", MODELO_TRANSCRICAO);
  form.append("file", arquivo, arquivo.name);
  form.append("response_format", "json");
  form.append("stream", "true");
  form.append("languages", "pt");
  form.append("prompt", "Relato de sessão terapêutica infantil (fonoaudiologia, terapia ocupacional, psicologia, fisioterapia).");
  const res = await fetch(`${GATEWAY}/v1/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
    signal,
  });
  if (!res.ok || !res.body) throw erroDoGateway(res.status, await res.text().catch(() => ""));

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  let parcial = "";
  let final: string | null = null;
  const tratar = (bloco: string) => {
    const dados = bloco
      .split("\n")
      .filter((l) => l.startsWith("data:"))
      .map((l) => l.slice(5).trim())
      .join("\n");
    if (!dados || dados === "[DONE]") return;
    const ev = JSON.parse(dados) as { type?: string; delta?: string; text?: string; error?: { message?: string } };
    if (ev.type === "transcript.text.delta" && ev.delta) parcial += ev.delta;
    else if (ev.type === "transcript.text.done") final = ev.text ?? parcial;
    else if (ev.type === "error" || ev.error) throw new ErroHttp(502, ev.error?.message ?? "Falha ao transcrever o áudio.");
  };
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value;
    let i: number;
    while ((i = buffer.search(/\r?\n\r?\n/)) >= 0) {
      tratar(buffer.slice(0, i));
      buffer = buffer.slice(i).replace(/^\r?\n\r?\n/, "");
    }
  }
  if (buffer.trim()) tratar(buffer);
  const texto = (final ?? parcial).trim();
  if (!texto) throw new ErroHttp(422, "Não ouvimos nenhuma fala. Grave novamente.");
  return texto;
}

const INSTRUCOES = `Você ajuda terapeutas de uma clínica infantil (crianças com necessidades especiais) a registrar a evolução da sessão.
Recebe a transcrição de um relato falado e devolve o texto da evolução em português do Brasil, em linguagem técnica, clara e objetiva, na terceira pessoa.
Regras:
- Use somente o que foi dito. Não invente fatos, números, testes, diagnósticos ou condutas.
- Corrija vícios de fala, repetições e erros de transcrição óbvios.
- Se um modelo for informado, siga as seções dele e deixe em branco a seção sem informação no relato.
- Sem modelo, organize em parágrafos curtos (objetivos trabalhados, estratégias, resposta da criança, orientações).
- Responda apenas com o texto da evolução, sem títulos extras, comentários ou markdown.`;

async function organizar(apiKey: string, transcricao: string, especialidade: string, modelo: string, signal: AbortSignal) {
  const runId = createLovableAiGatewayRunIdFetch();
  const provider = createOpenAI({
    baseURL: `${GATEWAY}/v1`,
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: runId.fetch,
  });
  const result = streamText({
    model: provider.responses(MODELO_TEXTO),
    instructions: INSTRUCOES,
    messages: [
      {
        role: "user",
        content: [
          `Especialidade: ${especialidade || "não informada"}`,
          modelo ? `Modelo a seguir:\n${modelo}` : "Sem modelo.",
          `Transcrição do relato:\n${transcricao}`,
        ].join("\n\n"),
      },
    ],
    abortSignal: signal,
    providerOptions: {
      openai: {
        forceReasoning: true,
        reasoningEffort: "low",
        reasoningSummary: "auto",
        store: false,
        include: ["reasoning.encrypted_content"],
      },
    },
  });
  const texto = (await result.text).trim();
  return texto;
}

export async function tratarEvolucaoPorVoz(request: Request) {
  try {
    const tamanho = Number(request.headers.get("content-length") ?? 0);
    if (tamanho > MAX_AUDIO_BYTES + 64 * 1024) throw new ErroHttp(413, "Gravação muito longa. Grave em partes de até 10 minutos.");
    const form = await request.formData();
    const arquivo = form.get("audio");
    const especialidadeId = String(form.get("especialidade_id") ?? "");
    const modelo = String(form.get("modelo") ?? "").slice(0, 5000);
    if (!especialidadeId) throw new ErroHttp(400, "Escolha a especialidade antes de gravar.");
    if (!(arquivo instanceof File) || arquivo.size < 2048) throw new ErroHttp(400, "Gravação vazia. Grave novamente.");
    if (arquivo.size > MAX_AUDIO_BYTES) throw new ErroHttp(413, "Gravação muito longa. Grave em partes de até 10 minutos.");
    if (!arquivo.type.startsWith("audio/")) throw new ErroHttp(400, "Formato de áudio não reconhecido.");

    const { especialidade } = await autorizar(request, especialidadeId);
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new ErroHttp(500, "Inteligência artificial não configurada.");

    const transcricao = await transcrever(apiKey, arquivo, request.signal);
    let texto = "";
    try {
      texto = await organizar(apiKey, transcricao, especialidade, modelo, request.signal);
    } catch (e) {
      console.error("[evolucao-voz] organizar", e instanceof Error ? e.message : e);
    }
    // Se a organização falhar, devolve a transcrição para o profissional revisar.
    return json(200, { transcricao, texto: texto || transcricao, organizado: !!texto });
  } catch (e) {
    if (e instanceof ErroHttp) return json(e.status, { erro: e.message });
    if (e instanceof Error && e.name === "AbortError") return json(499, { erro: "Cancelado." });
    console.error("[evolucao-voz]", e instanceof Error ? e.message : e);
    return json(500, { erro: "Falha ao processar o áudio. Tente novamente." });
  }
}
