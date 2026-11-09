import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { PdfError } from "../../documentos/server/errors";
import { validatePdfIds } from "../../documentos/server/paths";
import type { createFinalPdfService } from "./finalPdfService";

type FinalPdfService = ReturnType<typeof createFinalPdfService>;

const SECURITY_HEADERS = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };

function failure(action: string, error: unknown, ids: Record<string, string | undefined> = {}): Response {
  const requestId = randomUUID();
  const known = error instanceof PdfError;
  // No registrar hashes, imágenes, tokens ni claves.
  console.error("[contract-signature-final]", { requestId, action, ...ids, code: known ? error.code : "UNEXPECTED", errorName: error instanceof Error ? error.name : "DatabaseOrStorageError" });
  return new Response(JSON.stringify({ error: { code: known ? error.code : "UNEXPECTED", message: known ? error.message : "No se pudo completar la operación. Contacta al administrador con el identificador de este error." }, requestId }), {
    status: known ? error.status : 500, headers: { "Content-Type": "application/json", ...SECURITY_HEADERS },
  });
}

export interface FinalPdfReadDependencies {
  authorize(): Promise<string>;
  service(): Pick<FinalPdfService, "readVerified">;
}

// Consulta o descarga del PDF final: sale del servidor tras verificar el hash, nunca como URL firmada, que evitaría la comprobación.
export async function handleFinalPdfReadRequest(request: Request, contractId: string | undefined, processId: string | undefined, dependencies: FinalPdfReadDependencies): Promise<Response> {
  try {
    if (request.method !== "GET") throw new PdfError(405, "METHOD_NOT_ALLOWED", "Esta operación requiere GET.");
    const actorId = await dependencies.authorize();
    const ids = validatePdfIds(contractId, processId);
    const { bytes, sha256 } = await dependencies.service().readVerified(actorId, ids.contractId, ids.documentId);
    const disposition = new URL(request.url).searchParams.get("descargar") === "1" ? "attachment" : "inline";
    return new Response(new Uint8Array(bytes), { status: 200, headers: { "Content-Type": "application/pdf", "Content-Disposition": `${disposition}; filename="contrato-firmado-${ids.documentId}.pdf"`,
      "Content-Length": String(bytes.length), "X-Content-SHA256": sha256, ...SECURITY_HEADERS } });
  } catch (error) {
    return failure("read", error, { contractId, processId });
  }
}

export interface FinalPdfRecoveryDependencies {
  secret: string | undefined;
  service(): Pick<FinalPdfService, "recover">;
}

const digest = (value: string) => createHash("sha256").update(value).digest();

// Recuperación programada. Vercel Cron envía GET con "Authorization: Bearer CRON_SECRET". Sin secreto configurado, no atiende.
export async function handleFinalPdfRecoveryRequest(request: Request, dependencies: FinalPdfRecoveryDependencies): Promise<Response> {
  try {
    if (request.method !== "GET" && request.method !== "POST") throw new PdfError(405, "METHOD_NOT_ALLOWED", "Esta operación requiere GET o POST.");
    if (!dependencies.secret) throw new PdfError(500, "SERVER_CONFIGURATION", "Falta configurar CRON_SECRET en el servidor.");
    if (!timingSafeEqual(digest(request.headers.get("authorization") ?? ""), digest(`Bearer ${dependencies.secret}`))) throw new PdfError(401, "UNAUTHENTICATED", "No autorizado.");
    return new Response(JSON.stringify(await dependencies.service().recover()), { status: 200, headers: { "Content-Type": "application/json", ...SECURITY_HEADERS } });
  } catch (error) {
    return failure("recover", error);
  }
}
