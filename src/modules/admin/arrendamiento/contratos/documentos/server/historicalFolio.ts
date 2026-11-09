import type { PdfSourceDocument } from "./types";

export function historicalFolio(document: Pick<PdfSourceDocument, "datos_snapshot" | "nombre_archivo">): string {
  const snapshot = document.datos_snapshot;
  if (snapshot && typeof snapshot === "object" && "contrato" in snapshot) {
    const contract = snapshot.contrato;
    if (contract && typeof contract === "object" && "folio" in contract && typeof contract.folio === "string") {
      const folio = contract.folio.trim();
      if (folio && folio.length <= 160 && !/[\u0000-\u001f\u007f]/.test(folio)) return folio;
    }
  }
  return document.nombre_archivo.replace(/\.pdf$/i, "") || "Documento histórico";
}
