import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Eraser } from "lucide-react";
import { Button } from "@/components/ui/button";

export type AssinaturaPadRef = { vazio: () => boolean; imagem: () => string; limpar: () => void };

/** Quadro para assinar com o dedo (ou mouse). Exporta PNG reduzido, com fundo branco. */
export const AssinaturaPad = forwardRef<AssinaturaPadRef>(function AssinaturaPad(_, ref) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const desenhando = useRef(false);
  const traços = useRef(0);
  const [vazio, setVazio] = useState(true);

  useEffect(() => {
    const c = canvas.current!;
    const ajustar = () => {
      const r = c.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      c.width = r.width * dpr;
      c.height = r.height * dpr;
      const ctx = c.getContext("2d")!;
      ctx.scale(dpr, dpr);
      ctx.lineWidth = 2.4;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "#0f2850";
      traços.current = 0;
      setVazio(true);
    };
    ajustar();
    window.addEventListener("resize", ajustar);
    return () => window.removeEventListener("resize", ajustar);
  }, []);

  const ponto = (e: React.PointerEvent) => {
    const r = canvas.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  useImperativeHandle(ref, () => ({
    vazio: () => traços.current < 8,
    limpar: () => {
      const c = canvas.current!;
      c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
      traços.current = 0;
      setVazio(true);
    },
    imagem: () => {
      const c = canvas.current!;
      const largura = Math.min(600, c.width);
      const out = document.createElement("canvas");
      out.width = largura;
      out.height = Math.round((c.height / c.width) * largura);
      const ctx = out.getContext("2d")!;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, out.width, out.height);
      ctx.drawImage(c, 0, 0, out.width, out.height);
      return out.toDataURL("image/png");
    },
  }));

  return (
    <div>
      <div className="relative">
        <canvas
          ref={canvas}
          aria-label="Quadro de assinatura"
          className="h-44 w-full touch-none rounded-xl border-2 border-dashed border-primary/40 bg-card"
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            desenhando.current = true;
            const { x, y } = ponto(e);
            const ctx = canvas.current!.getContext("2d")!;
            ctx.beginPath();
            ctx.moveTo(x, y);
          }}
          onPointerMove={(e) => {
            if (!desenhando.current) return;
            const { x, y } = ponto(e);
            const ctx = canvas.current!.getContext("2d")!;
            ctx.lineTo(x, y);
            ctx.stroke();
            traços.current++;
            if (vazio && traços.current >= 8) setVazio(false);
          }}
          onPointerUp={() => (desenhando.current = false)}
          onPointerCancel={() => (desenhando.current = false)}
        />
        {vazio && (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
            Assine aqui com o dedo
          </span>
        )}
        <span className="pointer-events-none absolute bottom-8 left-6 right-6 border-b border-muted-foreground/30" />
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="mt-1"
        onClick={() => {
          const c = canvas.current!;
          c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
          traços.current = 0;
          setVazio(true);
        }}
      >
        <Eraser /> Limpar
      </Button>
    </div>
  );
});
