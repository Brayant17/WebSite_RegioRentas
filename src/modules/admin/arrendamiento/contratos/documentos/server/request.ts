import { randomUUID } from "node:crypto";
import { PdfError } from "./errors";
import { validatePdfIds } from "./paths";
import type { createPdfService } from "./pdfService";

export interface PdfRequestDependencies {
  authorize(): Promise<void>;
  service(): ReturnType<typeof createPdfService>;
}

export async function handlePdfRequest(request: Request, contractId: string | undefined, documentId: string | undefined,
  action: "generate" | "access", dependencies: PdfRequestDependencies): Promise<Response> {
  const requestId = randomUUID();
  const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
    status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", ...(status === 405 ? { Allow: "POST" } : {}) },
  });
  try {
    if (request.method !== "POST") throw new PdfError(405, "METHOD_NOT_ALLOWED", "Esta operación requiere POST.");
    const origin = request.headers.get("origin");
    if ((origin && origin !== new URL(request.url).origin) || request.headers.get("sec-fetch-site") === "cross-site") {
      throw new PdfError(403, "INVALID_ORIGIN", "La petición debe realizarse desde este sitio.");
    }
    await dependencies.authorize();
    const ids = validatePdfIds(contractId, documentId);
    let mode: "view" | "download" = "view";
    if (action === "access") {
      if (!request.headers.get("content-type")?.includes("application/json")) throw new PdfError(400, "INVALID_REQUEST", "Indica el tipo de acceso PDF en JSON.");
      const body = await request.text();
      if (body.length > 1024) throw new PdfError(400, "INVALID_REQUEST", "La solicitud de acceso no es válida.");
      let parsed: unknown;
      try { parsed = JSON.parse(body); } catch { throw new PdfError(400, "INVALID_REQUEST", "La solicitud no contiene JSON válido."); }
      if (typeof parsed !== "object" || parsed === null || !("mode" in parsed) || (parsed.mode !== "view" && parsed.mode !== "download")) {
        throw new PdfError(400, "INVALID_MODE", "Selecciona Ver PDF o Descargar PDF.");
      }
      mode = parsed.mode;
    }
    // El cliente privilegiado solo se construye después de validar la identidad y el rol.
    const service = dependencies.service();
    return json(action === "generate" ? await service.generate(ids.contractId, ids.documentId) : await service.access(ids.contractId, ids.documentId, mode));
  } catch (error) {
    const known = error instanceof PdfError;
    // No registrar HTML, cookies, tokens, claves ni URLs firmadas.
    console.error("[contract-pdf]", { requestId, action, contractId, documentId,
      code: known ? error.code : "UNEXPECTED", errorName: error instanceof Error ? error.name : "DatabaseOrStorageError",
      causeCode: known && typeof error.cause === "object" && error.cause !== null && "code" in error.cause ? String(error.cause.code) : undefined });
    return json({ error: { code: known ? error.code : "UNEXPECTED", message: known ? error.message : "No se pudo completar la operación PDF. Contacta al administrador con el identificador de este error." }, requestId }, known ? error.status : 500);
  }
}
