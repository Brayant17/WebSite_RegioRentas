import { randomUUID } from "node:crypto";
import { PdfError } from "../../documentos/server/errors";
import { validatePdfIds } from "../../documentos/server/paths";
import { validateCancellationReason, type createCancellationService } from "./cancellationService";
import type { createInvitationService } from "./invitationService";
import type { createSignatureService } from "./signatureService";

export interface SignatureRequestDependencies {
  // Devuelve el ID del administrador autenticado por cookie de sesión.
  authorize(): Promise<string>;
  service(): ReturnType<typeof createSignatureService>;
}

export interface CancellationRequestDependencies {
  authorize(): Promise<string>;
  service(): ReturnType<typeof createCancellationService>;
}

export interface InvitationRequestDependencies {
  authorize(): Promise<string>;
  service(): ReturnType<typeof createInvitationService>;
}

type Action = "start" | "cancel" | "invite" | "invitations";

// Método, origen y sesión se validan antes de construir cualquier servicio.
async function respond(request: Request, action: Action, ids: Record<string, string | undefined>, authorize: () => Promise<string>,
  run: (actorId: string) => Promise<unknown>, method: "GET" | "POST" = "POST"): Promise<Response> {
  const requestId = randomUUID();
  const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
    status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", ...(status === 405 ? { Allow: method } : {}) },
  });
  try {
    if (request.method !== method) throw new PdfError(405, "METHOD_NOT_ALLOWED", `Esta operación requiere ${method}.`);
    const origin = request.headers.get("origin");
    if ((origin && origin !== new URL(request.url).origin) || request.headers.get("sec-fetch-site") === "cross-site") {
      throw new PdfError(403, "INVALID_ORIGIN", "La petición debe realizarse desde este sitio.");
    }
    return json(await run(await authorize()));
  } catch (error) {
    const known = error instanceof PdfError;
    // No registrar HTML, snapshots, hashes, motivos, cookies, tokens ni claves.
    console.error("[contract-signature]", { requestId, action, ...ids,
      code: known ? error.code : "UNEXPECTED", errorName: error instanceof Error ? error.name : "DatabaseOrStorageError",
      causeCode: known && typeof error.cause === "object" && error.cause !== null && "code" in error.cause ? String(error.cause.code) : undefined });
    return json({ error: { code: known ? error.code : "UNEXPECTED", message: known ? error.message : "No se pudo completar la operación de firma. Contacta al administrador con el identificador de este error." }, requestId }, known ? error.status : 500);
  }
}

export function handleSignatureStartRequest(request: Request, contractId: string | undefined, documentId: string | undefined,
  dependencies: SignatureRequestDependencies): Promise<Response> {
  return respond(request, "start", { contractId, documentId }, () => dependencies.authorize(), actorId => {
    const ids = validatePdfIds(contractId, documentId);
    // El cliente privilegiado solo se construye después de validar la identidad y el rol.
    return dependencies.service().start(actorId, ids.contractId, ids.documentId);
  });
}

async function cancellationReason(request: Request): Promise<string> {
  if (!request.headers.get("content-type")?.includes("application/json")) throw new PdfError(400, "INVALID_REQUEST", "Indica el motivo de la cancelación en JSON.");
  const body = await request.text();
  if (body.length > 4096) throw new PdfError(400, "INVALID_REQUEST", "La solicitud de cancelación no es válida.");
  let parsed: unknown;
  try { parsed = JSON.parse(body); } catch { throw new PdfError(400, "INVALID_REQUEST", "La solicitud no contiene JSON válido."); }
  return validateCancellationReason(typeof parsed === "object" && parsed !== null && "motivo" in parsed ? parsed.motivo : undefined);
}

export function handleSignatureCancelRequest(request: Request, contractId: string | undefined, processId: string | undefined,
  dependencies: CancellationRequestDependencies): Promise<Response> {
  return respond(request, "cancel", { contractId, processId }, () => dependencies.authorize(), async () => {
    const ids = validatePdfIds(contractId, processId);
    const reason = await cancellationReason(request);
    return dependencies.service().cancel(ids.contractId, ids.documentId, reason);
  });
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Solo el firmante: el enlace lo decide el servidor, y la vigencia es la predeterminada.
async function invitationSigner(request: Request): Promise<string> {
  if (!request.headers.get("content-type")?.includes("application/json")) throw new PdfError(400, "INVALID_REQUEST", "Indica el firmante en JSON.");
  const body = await request.text();
  if (body.length > 1024) throw new PdfError(400, "INVALID_REQUEST", "La solicitud de invitación no es válida.");
  let parsed: unknown;
  try { parsed = JSON.parse(body); } catch { throw new PdfError(400, "INVALID_REQUEST", "La solicitud no contiene JSON válido."); }
  const signerId = typeof parsed === "object" && parsed !== null && "firmanteId" in parsed ? parsed.firmanteId : undefined;
  if (typeof signerId !== "string" || !UUID.test(signerId)) throw new PdfError(400, "INVALID_ID", "El identificador del firmante no es válido.");
  return signerId.toLowerCase();
}

export function handleSignatureInvitationRequest(request: Request, contractId: string | undefined, processId: string | undefined,
  dependencies: InvitationRequestDependencies): Promise<Response> {
  return respond(request, "invite", { contractId, processId }, () => dependencies.authorize(), async actorId => {
    const ids = validatePdfIds(contractId, processId);
    const signerId = await invitationSigner(request);
    return dependencies.service().issue({ actorId, contractId: ids.contractId, processId: ids.documentId, signerId });
  });
}

export function handleSignatureInvitationListRequest(request: Request, contractId: string | undefined, processId: string | undefined,
  dependencies: InvitationRequestDependencies): Promise<Response> {
  return respond(request, "invitations", { contractId, processId }, () => dependencies.authorize(), async actorId => {
    const ids = validatePdfIds(contractId, processId);
    return dependencies.service().list({ actorId, contractId: ids.contractId, processId: ids.documentId });
  }, "GET");
}
