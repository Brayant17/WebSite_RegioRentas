// Se carga solo en esta página. Build "legacy": admite navegadores móviles más antiguos.
export async function renderPdfPages(bytes: Uint8Array, container: HTMLElement, isCancelled: () => boolean): Promise<void> {
  const [pdfjs, worker] = await Promise.all([import("pdfjs-dist/legacy/build/pdf.mjs"), import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url")]);
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  // pdf.js se queda con el búfer que recibe: se le pasa una copia para conservar los bytes de la descarga.
  const pdf = await pdfjs.getDocument({ data: bytes.slice(), isEvalSupported: false }).promise;
  const scale = Math.min(window.devicePixelRatio || 1, 2);
  try {
    for (let number = 1; number <= pdf.numPages && !isCancelled(); number++) {
      const page = await pdf.getPage(number);
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: (Math.max(container.clientWidth, 320) / base.width) * scale });
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
      canvas.className = "mb-3 w-full bg-white shadow-sm";
      canvas.setAttribute("role", "img");
      canvas.setAttribute("aria-label", `Página ${number} de ${pdf.numPages} del contrato`);
      container.appendChild(canvas);
      await page.render({ canvas, viewport }).promise;
    }
  } finally {
    await pdf.destroy();
  }
}
