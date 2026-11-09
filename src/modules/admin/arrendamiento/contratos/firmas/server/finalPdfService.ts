import { PdfError } from "../../documentos/server/errors";
import { assertFinalPdfMatches, buildFinalSignedPdf, FINAL_PDF_GENERATOR, MAX_FINAL_PDF_BYTES, sha256Hex, type FinalPdfData } from "./finalPdf";

export interface FinalPdfRepository {
  pendingProcesses(limit: number): Promise<string[]>;
  data(processId: string): Promise<FinalPdfData>;
  folio(contractId: string): Promise<string | null>;
  register(input: { processId: string; originSha256: string; manifestSha256: string; finalSha256: string; sizeBytes: number; generator: string }): Promise<{ pdf_final_id: string; sha256: string; ya_registrado: boolean }>;
  // Registro inmutable del PDF final, con el administrador ya autorizado (p_actor).
  registeredPdf(actorId: string, processId: string): Promise<{ contrato_id: string; storage_path: string; sha256: string; size_bytes: number } | null>;
}

export interface FinalPdfStorage {
  download(path: string): Promise<Uint8Array>;
  upload(path: string, bytes: Uint8Array): Promise<void>;
}

// Errores de las RPC de 07 traducidos a respuestas sin datos sensibles.
export function finalPdfDatabaseError(cause: unknown): never {
  const code = typeof cause === "object" && cause !== null && "code" in cause ? String(cause.code) : "";
  const message = typeof cause === "object" && cause !== null && "message" in cause ? String(cause.message) : "";
  if (code === "42501") throw new PdfError(403, "FORBIDDEN", "Tu cuenta no tiene permisos de administrador para esta operación.", cause);
  if (code === "RF006") throw new PdfError(409, "FINAL_PDF_NOT_READY", message || "El proceso todavía no puede cerrarse.", cause);
  if (code === "RF009") throw new PdfError(409, "FINAL_PDF_REJECTED", message || "El PDF final fue rechazado.", cause);
  if (/no pendiente/.test(message)) throw new PdfError(409, "PROCESS_NOT_PENDING", "El proceso de firma ya no está pendiente.", cause);
  if (/Proceso inexistente/.test(message)) throw new PdfError(404, "PROCESS_NOT_FOUND", "El proceso de firma no existe.", cause);
  throw cause;
}

const isExisting = (error: unknown) => error instanceof PdfError && error.code === "OBJECT_EXISTS";

export function createFinalPdfService(repository: FinalPdfRepository, storage: FinalPdfStorage) {
  async function finalize(processId: string) {
    const data = await repository.data(processId).catch(finalPdfDatabaseError);
    const original = await storage.download(data.storage_path_origen);
    if (sha256Hex(original) !== data.sha256_documento_origen) {
      throw new PdfError(409, "FINAL_PDF_ORIGIN_MISMATCH", "El PDF original en Storage no coincide con el hash del proceso. No se generó el PDF final.");
    }
    let bytes = await buildFinalSignedPdf({ original, data, folio: await repository.folio(data.contrato_id).catch(finalPdfDatabaseError) });
    if (bytes.length > MAX_FINAL_PDF_BYTES) throw new PdfError(409, "FINAL_PDF_TOO_LARGE", "El PDF final supera el límite de 10 MiB del bucket.");
    try {
      await storage.upload(data.ruta_pdf_final, bytes);
    } catch (error) {
      if (!isExisting(error)) throw error;
      // Intento anterior o petición simultánea: un solo PDF por proceso. Se registra el que ya está, si es de este proceso.
      bytes = await storage.download(data.ruta_pdf_final);
      await assertFinalPdfMatches(bytes, data);
    }
    // El hash y el tamaño se calculan sobre los bytes que quedaron en la ruta final.
    const registered = await repository.register({ processId, originSha256: data.sha256_documento_origen, manifestSha256: data.sha256_manifiesto,
      finalSha256: sha256Hex(bytes), sizeBytes: bytes.length, generator: FINAL_PDF_GENERATOR }).catch(finalPdfDatabaseError);
    return { procesoId: processId, pdfFinalId: registered.pdf_final_id, sha256: registered.sha256, yaRegistrado: registered.ya_registrado };
  }

  return {
    finalize,
    // Reintenta lo que quedó a medias. Un proceso fallido no detiene a los demás y sigue pendiente para la siguiente corrida.
    async recover(limit = 5) {
      const processes = await repository.pendingProcesses(limit).catch(finalPdfDatabaseError);
      const failed: { procesoId: string; code: string }[] = [];
      let completed = 0;
      for (const processId of processes) {
        try { await finalize(processId); completed++; }
        catch (error) {
          const code = error instanceof PdfError ? error.code : "UNEXPECTED";
          // Otra petición lo cerró o se anuló entre listar y finalizar: no es un fallo.
          if (code === "PROCESS_NOT_PENDING") continue;
          failed.push({ procesoId: processId, code });
          console.error("[contract-signature-final]", { processId, code, errorName: error instanceof Error ? error.name : "DatabaseOrStorageError" });
        }
      }
      return { pendientes: processes.length, completados: completed, fallidos: failed };
    },
    // Descarga verificada: el hash se calcula sobre los bytes reales y nunca se entrega un archivo que no coincida.
    async readVerified(actorId: string, contractId: string, processId: string) {
      const registered = await repository.registeredPdf(actorId, processId).catch(finalPdfDatabaseError);
      if (!registered || registered.contrato_id !== contractId) throw new PdfError(404, "FINAL_PDF_NOT_FOUND", "Este proceso no tiene un PDF final registrado.");
      const bytes = await storage.download(registered.storage_path);
      if (sha256Hex(bytes) !== registered.sha256 || bytes.length !== Number(registered.size_bytes)) {
        throw new PdfError(409, "FINAL_PDF_TAMPERED", "El PDF final en Storage no coincide con el hash registrado. No se entregó el archivo; requiere revisión.");
      }
      return { bytes, sha256: registered.sha256 };
    },
  };
}
