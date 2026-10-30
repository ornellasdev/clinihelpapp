// Gravação no navegador em WAV (funciona em Android e iPhone), reduzida para 16 kHz para caber ~12 min por envio.
const TAXA_SAIDA = 16_000;

function reamostrar(chunks: readonly Float32Array[], taxaEntrada: number) {
  const total = chunks.reduce((s, c) => s + c.length, 0);
  const entrada = new Float32Array(total);
  let o = 0;
  for (const c of chunks) {
    entrada.set(c, o);
    o += c.length;
  }
  if (taxaEntrada <= TAXA_SAIDA) return { dados: entrada, taxa: taxaEntrada };
  const fator = taxaEntrada / TAXA_SAIDA;
  const saida = new Float32Array(Math.floor(total / fator));
  for (let i = 0; i < saida.length; i++) {
    const ini = Math.floor(i * fator);
    const fim = Math.min(total, Math.floor((i + 1) * fator));
    let s = 0;
    for (let j = ini; j < fim; j++) s += entrada[j]!;
    saida[i] = s / Math.max(1, fim - ini);
  }
  return { dados: saida, taxa: TAXA_SAIDA };
}

function codificarWav(dados: Float32Array, taxa: number): Blob {
  const bytes = new ArrayBuffer(44 + dados.length * 2);
  const v = new DataView(bytes);
  const tag = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(off + i, s.charCodeAt(i));
  };
  tag(0, "RIFF");
  v.setUint32(4, 36 + dados.length * 2, true);
  tag(8, "WAVE");
  tag(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, taxa, true);
  v.setUint32(28, taxa * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  tag(36, "data");
  v.setUint32(40, dados.length * 2, true);
  let off = 44;
  for (const x of dados) {
    const s = Math.max(-1, Math.min(1, x));
    v.setInt16(off, s * (s < 0 ? 32768 : 32767), true);
    off += 2;
  }
  return new Blob([bytes], { type: "audio/wav" });
}

export type Gravacao = { parar: () => Promise<File>; cancelar: () => void; nivel: () => number };

export async function iniciarGravacao(): Promise<Gravacao> {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error("Este navegador não permite gravar áudio.");
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
  let ctx: AudioContext | undefined;
  try {
    ctx = new AudioContext();
    await ctx.resume();
    const audio = ctx;
    const source = audio.createMediaStreamSource(stream);
    const node = audio.createScriptProcessor(4096, 1, 1);
    const chunks: Float32Array[] = [];
    let ultimoNivel = 0;
    node.onaudioprocess = (ev) => {
      const c = new Float32Array(ev.inputBuffer.getChannelData(0));
      chunks.push(c);
      let pico = 0;
      for (const x of c) pico = Math.max(pico, Math.abs(x));
      ultimoNivel = pico;
    };
    source.connect(node);
    node.connect(audio.destination);
    let encerrada = false;
    const encerrar = async () => {
      encerrada = true;
      stream.getTracks().forEach((t) => t.stop());
      node.disconnect();
      source.disconnect();
      node.onaudioprocess = null;
      await audio.close().catch(() => {});
    };
    return {
      nivel: () => ultimoNivel,
      cancelar: () => {
        if (!encerrada) void encerrar();
      },
      async parar() {
        if (encerrada) throw new Error("Gravação já encerrada.");
        const taxa = audio.sampleRate;
        await encerrar();
        const { dados, taxa: t } = reamostrar(chunks, taxa);
        if (dados.length < t * 0.7) throw new Error("Gravação muito curta. Fale por mais alguns segundos.");
        return new File([codificarWav(dados, t)], "evolucao.wav", { type: "audio/wav" });
      },
    };
  } catch (e) {
    stream.getTracks().forEach((t) => t.stop());
    await ctx?.close().catch(() => {});
    throw e;
  }
}
