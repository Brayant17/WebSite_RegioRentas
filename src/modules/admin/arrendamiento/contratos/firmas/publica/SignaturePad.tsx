import { useCallback, useEffect, useRef, type PointerEvent } from "react";
import { Button } from "@/components/ui/button";

type Point = { x: number; y: number };

// Tamaño fijo de la imagen enviada: no depende de la pantalla ni de girar el celular.
export const SIGNATURE_EXPORT = { width: 1000, height: 400 } as const;
const STROKE_RATIO = 0.006;
const MIN_STROKE_LENGTH = 40; // Píxeles de la imagen. Evita avanzar con un toque; la validación real es la del servidor.

function paint(context: CanvasRenderingContext2D, width: number, height: number, strokes: Point[][]) {
  context.clearRect(0, 0, width, height);
  context.strokeStyle = "#111827"; context.lineWidth = Math.max(width * STROKE_RATIO, 1.5); context.lineCap = "round"; context.lineJoin = "round";
  for (const stroke of strokes) {
    if (stroke.length < 2) continue;
    context.beginPath();
    context.moveTo(stroke[0].x * width, stroke[0].y * height);
    for (const point of stroke.slice(1)) context.lineTo(point.x * width, point.y * height);
    context.stroke();
  }
}

function strokesLength(strokes: Point[][]): number {
  let total = 0;
  for (const stroke of strokes) for (let i = 1; i < stroke.length; i++) {
    total += Math.hypot((stroke[i].x - stroke[i - 1].x) * SIGNATURE_EXPORT.width, (stroke[i].y - stroke[i - 1].y) * SIGNATURE_EXPORT.height);
  }
  return total;
}

function exportPng(strokes: Point[][]): string | null {
  const canvas = document.createElement("canvas");
  canvas.width = SIGNATURE_EXPORT.width; canvas.height = SIGNATURE_EXPORT.height;
  const context = canvas.getContext("2d");
  if (!context) return null;
  paint(context, canvas.width, canvas.height, strokes);
  return canvas.toDataURL("image/png").split(",")[1] ?? null;
}

// Pointer Events cubre ratón, lápiz y dedo. touch-action:none impide que el trazo desplace la página en el celular.
// onChange recibe el PNG en base64, o null si el lienzo no tiene un trazo suficiente.
export function SignaturePad({ onChange }: { onChange: (pngBase64: string | null) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const strokes = useRef<Point[][]>([]);
  const drawing = useRef<number | null>(null);

  // Los trazos se guardan normalizados, para redibujarlos igual al cambiar de tamaño u orientación.
  const redraw = useCallback(() => {
    const element = canvas.current;
    const context = element?.getContext("2d");
    if (!element || !context) return;
    const ratio = window.devicePixelRatio || 1;
    const { width, height } = element.getBoundingClientRect();
    if (element.width !== Math.round(width * ratio) || element.height !== Math.round(height * ratio)) { element.width = Math.round(width * ratio); element.height = Math.round(height * ratio); }
    paint(context, element.width, element.height, strokes.current);
  }, []);

  useEffect(() => {
    redraw();
    if (typeof ResizeObserver === "undefined" || !canvas.current) return;
    const observer = new ResizeObserver(redraw);
    observer.observe(canvas.current);
    return () => observer.disconnect();
  }, [redraw]);

  const pointOf = (event: { clientX: number; clientY: number }): Point => {
    const rect = (canvas.current as HTMLCanvasElement).getBoundingClientRect();
    return { x: Math.min(Math.max((event.clientX - rect.left) / rect.width, 0), 1), y: Math.min(Math.max((event.clientY - rect.top) / rect.height, 0), 1) };
  };
  const down = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!event.isPrimary || drawing.current !== null) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    drawing.current = event.pointerId;
    strokes.current.push([pointOf(event)]);
  };
  const move = (event: PointerEvent<HTMLCanvasElement>) => {
    if (drawing.current !== event.pointerId) return;
    const stroke = strokes.current[strokes.current.length - 1];
    const events = event.nativeEvent.getCoalescedEvents?.() ?? [];
    stroke.push(...(events.length ? events : [event]).map(pointOf));
    redraw();
  };
  const up = (event: PointerEvent<HTMLCanvasElement>) => {
    if (drawing.current !== event.pointerId) return;
    drawing.current = null;
    redraw();
    onChange(strokesLength(strokes.current) >= MIN_STROKE_LENGTH ? exportPng(strokes.current) : null);
  };
  const clear = () => { strokes.current = []; drawing.current = null; redraw(); onChange(null); };

  return <div className="space-y-2">
    <canvas ref={canvas} data-testid="signature-canvas" aria-label="Lienzo para dibujar tu firma con el dedo, un lápiz o el ratón" role="img"
      className="block aspect-[5/2] w-full cursor-crosshair rounded-md border-2 border-dashed border-gray-400 bg-white" style={{ touchAction: "none" }}
      onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} />
    <Button type="button" size="sm" variant="outline" onClick={clear}>Borrar y volver a dibujar</Button>
  </div>;
}
