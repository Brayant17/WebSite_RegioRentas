import { PdfError } from "../../documentos/server/errors";
import { validatePdfIds } from "../../documentos/server/paths";
import { signatureDatabaseError } from "./signatureService";

export const MAX_CANCELLATION_REASON = 1000;

// Cliente con la sesión del administrador: la RLS de procesos_firma y admin_actual() deciden; sin service_role.
export interface CancellationRepository {
  process(processId: string): Promise<{ id: string; contrato_id: string; estado: string } | null>;
  cancel(processId: string, reason: string): Promise<void>;
}

export function validateCancellationReason(value: unknown): string {
  const reason = typeof value === "string" ? value.trim() : "";
  if (!reason || reason.length > MAX_CANCELLATION_REASON) throw new PdfError(400, "INVALID_REASON", `Indica el motivo de la cancelación (máximo ${MAX_CANCELLATION_REASON} caracteres).`);
  return reason;
}

export function createCancellationService(repository: CancellationRepository) {
  return {
    async cancel(contractId: string, processId: string, reasonInput: unknown) {
      const ids = validatePdfIds(contractId, processId);
      const reason = validateCancellationReason(reasonInput);
      const process = await repository.process(ids.documentId).catch(signatureDatabaseError);
      // Ajeno, inexistente o invisible por RLS: misma respuesta, sin revelar procesos de otros contratos.
      if (!process || process.contrato_id !== ids.contractId) throw new PdfError(404, "PROCESS_NOT_FOUND", "El proceso de firma no existe o no pertenece a este contrato.");
      if (process.estado !== "PENDIENTE") throw new PdfError(409, "PROCESS_NOT_PENDING", "Solo se puede cancelar un proceso de firma PENDIENTE.");
      await repository.cancel(ids.documentId, reason).catch(signatureDatabaseError);
      return { procesoId: ids.documentId, estado: "CANCELADO" as const };
    },
  };
}
