/** Criptografia das chaves das contas de recebimento (AES-GCM, Web Crypto — roda no servidor). */

const enc = new TextEncoder();

function b64(bytes: Uint8Array) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}
function deB64(s: string) {
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}

async function chave() {
  const segredo = process.env["PAGAMENTOS_CHAVE_CRIPTO"];
  if (!segredo) throw new Error("Configuração de pagamentos ausente no servidor.");
  const hash = await crypto.subtle.digest("SHA-256", enc.encode(segredo));
  return crypto.subtle.importKey("raw", hash, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function cifrar(texto: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const dados = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await chave(), enc.encode(texto)));
  return `${b64(iv)}.${b64(dados)}`;
}

export async function decifrar(cifrado: string) {
  const [iv, dados] = cifrado.split(".");
  if (!iv || !dados) throw new Error("Chave de recebimento inválida.");
  const claro = await crypto.subtle.decrypt({ name: "AES-GCM", iv: deB64(iv) }, await chave(), deB64(dados));
  return new TextDecoder().decode(claro);
}

export async function sha256Hex(texto: string) {
  const h = new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(texto)));
  return [...h].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Texto aleatório seguro para links e tokens (letras/números). */
export function tokenAleatorio(bytes = 32) {
  const v = crypto.getRandomValues(new Uint8Array(bytes));
  return b64(v).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function iguaisSeguro(a: string, b: string) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
