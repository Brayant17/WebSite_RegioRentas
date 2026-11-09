import { useEffect, useMemo, useRef, useState } from "react";
import { renderPdfPages } from "./pdfRenderer";

const END_TOLERANCE_PX = 8;

// onReachedEnd: el firmante llegó al final del documento ya dibujado. Es un requisito de la interfaz, no una prueba de lectura,
// y no se registra como evidencia. Descargar el PDF nunca lo sustituye: sin verlo en pantalla no se avanza.
export function PdfViewer({ bytes, onRendered, onFailed, onReachedEnd }: { bytes: Uint8Array; onRendered: () => void; onFailed: () => void; onReachedEnd: () => void }) {
  const container = useRef<HTMLDivElement>(null);
  const rendered = useRef(false);
  const [status, setStatus] = useState<"rendering" | "ready" | "failed">("rendering");
  const downloadUrl = useMemo(() => URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/pdf" })), [bytes]);
  useEffect(() => () => URL.revokeObjectURL(downloadUrl), [downloadUrl]);

  // Solo cuenta con todas las páginas dibujadas: antes, el final visible no es el final del documento.
  const checkEnd = () => {
    const element = container.current;
    if (rendered.current && element && element.scrollTop + element.clientHeight >= element.scrollHeight - END_TOLERANCE_PX) onReachedEnd();
  };

  useEffect(() => {
    let cancelled = false;
    const target = container.current as HTMLDivElement;
    rendered.current = false;
    setStatus("rendering");
    renderPdfPages(bytes, target, () => cancelled)
      .then(() => { if (cancelled) return; rendered.current = true; setStatus("ready"); onRendered(); checkEnd(); })
      .catch(() => { if (!cancelled) { setStatus("failed"); onFailed(); } });
    return () => { cancelled = true; target.replaceChildren(); };
    // Los avisos al padre no deben repetir el dibujo del documento.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bytes]);

  return <div className="space-y-2">
    {status === "rendering" && <p role="status" className="text-sm">Preparando el documento…</p>}
    {status === "failed" && <p role="alert" className="text-sm text-destructive">Este navegador no pudo mostrar el documento, así que no puedes aceptar ni firmar desde aquí. Abre este mismo enlace en un navegador compatible, como una versión actual de Chrome, Safari, Edge o Firefox. Descargar el PDF no habilita la firma.</p>}
    <div ref={container} data-testid="pdf-pages" onScroll={checkEnd} className="max-h-[70vh] overflow-y-auto rounded-md border bg-gray-100 p-2" tabIndex={0} aria-label="Documento a firmar" />
    <a className="text-sm underline" href={downloadUrl} download="contrato-a-firmar.pdf">Descargar el PDF</a>
  </div>;
}
