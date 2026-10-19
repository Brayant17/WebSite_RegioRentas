async function requestPdf<T>(contractId: string, documentId: string, action: string, body?: object): Promise<T> {
  const response = await fetch(`/api/admin/arrendamiento/contratos/${encodeURIComponent(contractId)}/documentos/${encodeURIComponent(documentId)}/${action}`, {
    method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body ?? {}),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error?.message || "No se pudo completar la operación PDF. Vuelve a intentarlo.");
  if (!data) throw new Error("El servidor devolvió una respuesta PDF no válida.");
  return data;
}
export const generateDocumentPdf = (contractId: string, documentId: string) => requestPdf<{ storagePath: string }>(contractId, documentId, "pdf");
export const accessDocumentPdf = (contractId: string, documentId: string, mode: "view" | "download") => requestPdf<{ url: string; expiresIn: number }>(contractId, documentId, "pdf-url", { mode });
