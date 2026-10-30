import { useCallback, useEffect, useRef, useState } from "react";
import { CHAVE_ULTIMA_ATIVIDADE, segundosParaSair, situacaoInatividade } from "@/lib/inatividade";

const EVENTOS = ["pointerdown", "keydown", "wheel", "touchstart", "scroll", "mousemove"] as const;

function lerUltima(): number {
  const v = Number(window.localStorage.getItem(CHAVE_ULTIMA_ATIVIDADE));
  return Number.isFinite(v) && v > 0 ? v : Date.now();
}

/**
 * Monitora mouse/teclado/toque (em todas as abas) e chama `aoExpirar` após 15 min sem uso.
 * Devolve os segundos restantes durante o último minuto (para o aviso) e `continuar` para renovar.
 */
export function useLogoffInatividade(aoExpirar: () => void, ativo = true) {
  const [restante, setRestante] = useState<number | null>(null);
  const expirou = useRef(false);
  const callback = useRef(aoExpirar);
  callback.current = aoExpirar;

  const marcar = useCallback(() => {
    const agora = Date.now();
    // grava no máximo a cada 5 s para não pesar
    if (agora - lerUltima() > 5_000) window.localStorage.setItem(CHAVE_ULTIMA_ATIVIDADE, String(agora));
  }, []);

  const continuar = useCallback(() => {
    window.localStorage.setItem(CHAVE_ULTIMA_ATIVIDADE, String(Date.now()));
    setRestante(null);
  }, []);

  useEffect(() => {
    if (!ativo) return;
    expirou.current = false;
    window.localStorage.setItem(CHAVE_ULTIMA_ATIVIDADE, String(Date.now()));

    const verificar = () => {
      if (expirou.current) return;
      const ultima = lerUltima();
      const agora = Date.now();
      const s = situacaoInatividade(ultima, agora);
      if (s === "expirado") {
        expirou.current = true;
        setRestante(null);
        callback.current();
      } else if (s === "aviso") {
        setRestante(segundosParaSair(ultima, agora));
      } else {
        setRestante(null);
      }
    };

    for (const ev of EVENTOS) window.addEventListener(ev, marcar, { passive: true });
    const aoVoltar = () => document.visibilityState === "visible" && verificar();
    document.addEventListener("visibilitychange", aoVoltar);
    window.addEventListener("storage", verificar);
    const timer = window.setInterval(verificar, 1_000);
    return () => {
      for (const ev of EVENTOS) window.removeEventListener(ev, marcar);
      document.removeEventListener("visibilitychange", aoVoltar);
      window.removeEventListener("storage", verificar);
      window.clearInterval(timer);
    };
  }, [ativo, marcar]);

  return { restante, continuar };
}
