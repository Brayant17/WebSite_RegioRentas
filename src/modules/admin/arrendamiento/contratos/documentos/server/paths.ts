import { PdfError } from "./errors";

export function validatePdfIds(contractId: string | undefined, documentId: string | undefined) {
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!contractId || !documentId || !uuid.test(contractId) || !uuid.test(documentId)) {
    throw new PdfError(400, "INVALID_ID", "El identificador del contrato o del documento no es válido.");
  }
  return { contractId: contractId.toLowerCase(), documentId: documentId.toLowerCase() };
}

export function pdfStoragePath(contractId: string, documentId: string, filename: string) {
  const ids = validatePdfIds(contractId, documentId);
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,159}\.pdf$/i.test(filename)) {
    throw new PdfError(422, "INVALID_FILENAME", "El nombre de archivo histórico no es seguro. Revisa el documento; no se modificará automáticamente.");
  }
  return `${ids.contractId}/${ids.documentId}/${filename}`;
}
