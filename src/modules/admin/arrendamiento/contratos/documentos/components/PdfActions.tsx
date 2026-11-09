import { Button } from "@/components/ui/button";
import { useDocumentPdf } from "../hooks/useDocumentPdf";

export function PdfActions({ contractId, documentId, storagePath }: { contractId: string; documentId: string; storagePath: string | null }) {
  const pdf = useDocumentPdf(contractId, documentId, storagePath);
  async function open(mode: "view" | "download") {
    if (pdf.busy) return;
    const tab = window.open("about:blank", "_blank");
    if (tab) tab.opener = null;
    let navigated = false;
    await pdf.run(mode, url => {
      navigated = true;
      if (tab) tab.location.replace(url);
      else window.location.assign(url);
    });
    if (!navigated) tab?.close();
  }
  return <div className="space-y-2">
    <div className="flex flex-wrap gap-2">
      {!pdf.storagePath ? <Button size="sm" disabled={pdf.busy} onClick={() => void pdf.run("generate")}>{pdf.busy ? "Generando PDF…" : "Generar PDF"}</Button> : <>
        <Button size="sm" variant="outline" disabled={pdf.busy} onClick={() => void open("view")}>Ver PDF</Button>
        <Button size="sm" variant="outline" disabled={pdf.busy} onClick={() => void open("download")}>Descargar PDF</Button>
      </>}
    </div>
    {pdf.busy && pdf.storagePath && <p role="status" className="text-sm">Preparando acceso al PDF…</p>}
    {pdf.error && <p role="alert" className="text-sm text-destructive">{pdf.error}</p>}
  </div>;
}
