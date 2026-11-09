import { useCallback, useEffect, useState } from "react";
import { documentErrorMessage, listContractDocuments, loadHistoricalDocument } from "../services/documentos.service";
import { createPreviewDocument } from "../../plantillas/sanitize";

function useDocumentQuery<T>(load: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const reload = useCallback(() => setRevision(value => value + 1), []);
  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError(null); setData(null);
    load().then(value => { if (!cancelled) setData(value); })
      .catch((err: unknown) => { if (!cancelled) setError(documentErrorMessage(err)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [load, revision]);
  useEffect(() => {
    const restored = (event: PageTransitionEvent) => { if (event.persisted) reload(); };
    window.addEventListener("pageshow", restored);
    return () => window.removeEventListener("pageshow", restored);
  }, [reload]);
  return { data, loading, error, reload };
}

export function useContractDocuments(contractId: string) {
  return useDocumentQuery(useCallback(() => listContractDocuments(contractId), [contractId]));
}

export function useHistoricalDocument(contractId: string, documentId: string) {
  return useDocumentQuery(useCallback(async () => {
    const document = await loadHistoricalDocument(contractId, documentId);
    return { document, iframeDocument: createPreviewDocument(document.contenido_renderizado!) };
  }, [contractId, documentId]));
}
