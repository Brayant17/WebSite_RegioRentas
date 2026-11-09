import { PdfError } from "../../documentos/server/errors";
import { decodeSignatureBase64, validateDrawnSignature } from "./drawnSignature";
import { sha256Hex } from "./finalPdf";
import type { createFinalPdfService } from "./finalPdfService";

export interface SigningRepository {
  sign(input: { tokenHash: string; otpHmac: string; documentSha256: string; pngBase64: string; pngSha256: string; confirmed: boolean; ip: string | null; userAgent: string | null }): Promise<{
    resultado: string; intentos_restantes: number; firma_id?: string; firmado_at?: string; sha256_firma?: string; sha256_evidencia?: string; pdf_final_requerido?: boolean; firmantes_pendientes?: number;
  }>;
}

const REJECTIONS: Record<string, [number, string, string]> = {
  RF001: [404, "INVITATION_INVALID", "La invitación no es válida, venció o ya se utilizó."],
  RF002: [409, "DOCUMENT_MISMATCH", "La firma no corresponde al documento del proceso."],
  RF003: [422, "SIGNING_STEP_MISSING", "Falta un paso previo: visualizar, aceptar o confirmar la firma."],
  RF004: [429, "OTP_LIMIT_REACHED", "Ya no se pueden generar más códigos con este enlace. Pide una invitación nueva a quien te la compartió."],
  RF005: [429, "OTP_TOO_SOON", "Espera un minuto antes de pedir otro código."],
  RF006: [409, "SIGNING_BLOCKED", "No se puede cerrar el proceso. Contacta al administrador."],
  RF008: [422, "DRAWN_SIGNATURE_INVALID", "La firma enviada no es válida."],
};

export function signingError(cause: unknown): never {
  const code = typeof cause === "object" && cause !== null && "code" in cause ? String(cause.code) : "";
  const known = REJECTIONS[code];
  if (known) throw new PdfError(known[0], known[1], known[2], cause);
  throw cause;
}

// Valida la firma dibujada antes de gastar un intento de OTP y, si es la última, intenta cerrar enseguida.
// Un fallo del cierre no invalida la firma: queda confirmada y la recuperación programada lo reintenta.
export function createSigningService(repository: SigningRepository, finalPdf: Pick<ReturnType<typeof createFinalPdfService>, "finalize">) {
  return {
    async submit(input: { processId: string; tokenHash: string; otpHmac: string; documentSha256: string; pngBase64: unknown; confirmed: boolean; ip?: string | null; userAgent?: string | null }) {
      if (input.confirmed !== true) throw new PdfError(422, "SIGNATURE_NOT_CONFIRMED", "Confirma tu firma antes de continuar.");
      const png = decodeSignatureBase64(input.pngBase64);
      validateDrawnSignature(png);
      const result = await repository.sign({ tokenHash: input.tokenHash, otpHmac: input.otpHmac, documentSha256: input.documentSha256, pngBase64: input.pngBase64 as string,
        pngSha256: sha256Hex(png), confirmed: true, ip: input.ip ?? null, userAgent: input.userAgent ?? null }).catch(signingError);
      if (result.resultado !== "FIRMADO" || !result.pdf_final_requerido) return { ...result, finalizacion: "NO_REQUERIDA" as const };
      try {
        const final = await finalPdf.finalize(input.processId);
        return { ...result, finalizacion: "COMPLETADA" as const, sha256PdfFinal: final.sha256 };
      } catch (error) {
        console.error("[contract-signature-final]", { processId: input.processId, code: error instanceof PdfError ? error.code : "UNEXPECTED", errorName: error instanceof Error ? error.name : "DatabaseOrStorageError" });
        return { ...result, finalizacion: "PENDIENTE" as const };
      }
    },
  };
}
