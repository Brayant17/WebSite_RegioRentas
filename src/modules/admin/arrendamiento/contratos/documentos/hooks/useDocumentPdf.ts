import { useRef, useState } from "react";
import { accessDocumentPdf, generateDocumentPdf } from "../services/pdf.client";

export function useDocumentPdf(contractId: string, documentId: string, initialPath: string | null) {
  const locked = useRef(false);
  const [storagePath, setStoragePath] = useState(initialPath);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function run(mode: "generate" | "view" | "download", navigate?: (url: string) => void) {
    if (locked.current) return;
    locked.current = true; setBusy(true); setError(null);
    try {
      if (mode === "generate") setStoragePath((await generateDocumentPdf(contractId, documentId)).storagePath);
      else navigate?.((await accessDocumentPdf(contractId, documentId, mode)).url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo completar la operación PDF.");
    } finally { locked.current = false; setBusy(false); }
  }
  return { storagePath, busy, error, run };
}
