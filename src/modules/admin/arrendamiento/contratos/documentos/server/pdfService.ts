import { PdfError } from "./errors";
import { historicalFolio } from "./historicalFolio";
import { pdfStoragePath, validatePdfIds } from "./paths";
import type { PdfDocumentRepository, PdfGenerator, PdfStorage } from "./types";

export function createPdfService(repository: PdfDocumentRepository, storage: PdfStorage, generatePdf: PdfGenerator) {
  async function source(contractId: string, documentId: string) {
    const ids = validatePdfIds(contractId, documentId);
    const document = await repository.get(ids.contractId, ids.documentId);
    if (!document || document.contrato_id !== ids.contractId || document.id !== ids.documentId) {
      throw new PdfError(404, "DOCUMENT_NOT_FOUND", "El documento no existe o no pertenece a este contrato.");
    }
    const path = pdfStoragePath(document.contrato_id, document.id, document.nombre_archivo);
    if (document.storage_path !== null && document.storage_path !== path) {
      throw new PdfError(409, "PATH_MISMATCH", "La ruta guardada no corresponde al documento. Requiere revisión administrativa; no se sobrescribirá.");
    }
    await storage.assertPrivateBucket();
    return { document, path };
  }

  async function attach(contractId: string, documentId: string, path: string) {
    try {
      if (await repository.attachPath(contractId, documentId, path)) return;
      const current = await repository.get(contractId, documentId);
      if (current?.storage_path === path) return; // Otra petición ya completó el vínculo.
    } catch (cause) {
      throw new PdfError(500, "PDF_PENDING_LINK", "El PDF está guardado, pero no se pudo vincular al documento. Vuelve a solicitar Generar PDF: se recuperará el archivo existente sin reemplazarlo.", cause);
    }
    throw new PdfError(409, "PDF_LINK_CONFLICT", "El archivo existe, pero el documento cambió mientras se vinculaba. Actualiza el listado; no se ha sobrescrito el PDF.");
  }

  return {
    async generate(contractId: string, documentId: string) {
      const { document, path } = await source(contractId, documentId);
      if (document.storage_path) {
        if (!await storage.hasPdf(path)) throw new PdfError(409, "PDF_OBJECT_MISSING", "El documento tiene una ruta PDF, pero el archivo no está disponible. Requiere revisión; no se regenerará.");
        return { storagePath: path, alreadyExists: true, reconciled: false };
      }
      if (!document.contenido_renderizado?.trim()) throw new PdfError(422, "EMPTY_HTML", "El documento no tiene contenido HTML histórico para generar el PDF.");
      if (Buffer.byteLength(document.contenido_renderizado, "utf8") > 1_000_000) throw new PdfError(422, "HTML_TOO_LARGE", "El contenido supera el límite de 1 MB para esta etapa de generación PDF.");
      const existing = await storage.hasPdf(path);
      if (!existing) {
        let bytes: Uint8Array;
        try {
          bytes = await generatePdf(document.contenido_renderizado, { folio: historicalFolio(document) });
        } catch (cause) {
          if (cause instanceof PdfError) throw cause;
          throw new PdfError(500, "CHROMIUM_FAILED", "Chromium no pudo generar el PDF. Revisa la instalación del navegador y vuelve a intentarlo.", cause);
        }
        if (bytes.byteLength > 10 * 1024 * 1024 || Buffer.from(bytes.subarray(0, 5)).toString() !== "%PDF-") {
          throw new PdfError(500, "INVALID_PDF", "El generador no produjo un PDF válido dentro del límite de 10 MB.");
        }
        try {
          await storage.upload(path, bytes);
        } catch (cause) {
          // Upload inmutable: ante una carrera, el primer objeto válido es el definitivo.
          if (!(cause instanceof PdfError) || cause.code !== "OBJECT_EXISTS") throw cause;
          if (!await storage.hasPdf(path)) throw new PdfError(409, "UPLOAD_CONFLICT", "Otra petición está guardando el PDF. Espera y actualiza el documento.");
        }
      }
      await attach(document.contrato_id, document.id, path);
      return { storagePath: path, alreadyExists: existing, reconciled: existing };
    },
    async access(contractId: string, documentId: string, mode: "view" | "download") {
      const { document, path } = await source(contractId, documentId);
      if (!document.storage_path) throw new PdfError(409, "PDF_NOT_GENERATED", "Este documento todavía no tiene un PDF vinculado. Genera el PDF primero.");
      if (!await storage.hasPdf(path)) throw new PdfError(409, "PDF_OBJECT_MISSING", "El archivo PDF no está disponible. Requiere revisión administrativa.");
      return { url: await storage.signedUrl(path, mode === "download" ? document.nombre_archivo : undefined), expiresIn: 300 };
    },
  };
}
