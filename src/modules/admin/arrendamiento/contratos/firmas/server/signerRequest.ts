import { isIP } from "node:net";
import { randomUUID } from "node:crypto";
import { PdfError } from "../../documentos/server/errors";
import { hashInvitationToken, type createSignerFlowService, type RequestContext } from "./signerFlowService";

export interface SignerRequestDependencies { service(): ReturnType<typeof createSignerFlowService> }

const SECURITY_HEADERS = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer", "X-Robots-Tag": "noindex" };
const TOKEN = /^[A-Za-z0-9_-]{43}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const MAX_JSON_BYTES = 512 * 1024;

const invalidInvitation = () => new PdfError(404, "INVITATION_INVALID", "La invitación no es válida, venció o ya se utilizó.");
const invalidRequest = () => new PdfError(400, "INVALID_REQUEST", "La solicitud no es válida.");

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", ...SECURITY_HEADERS, ...(status === 405 ? { Allow: "POST" } : {}) } });
}

// El token viaja en una cabecera, no en la URL: no queda en los registros de acceso.
function tokenHash(request: Request): string {
  const token = request.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  if (!token || !TOKEN.test(token)) throw invalidInvitation();
  return hashInvitationToken(token);
}

// x-real-ip la fija Vercel. Un valor que no sea una IP se descarta: la columna es inet y rompería la evidencia.
function context(request: Request): RequestContext {
  const candidate = request.headers.get("x-real-ip")?.trim() || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return { ip: candidate && isIP(candidate) ? candidate : null, userAgent: request.headers.get("user-agent")?.slice(0, 512) || null };
}

async function jsonBody(request: Request): Promise<Record<string, unknown>> {
  if (!request.headers.get("content-type")?.includes("application/json")) throw invalidRequest();
  const text = await request.text();
  if (text.length > MAX_JSON_BYTES) throw new PdfError(413, "REQUEST_TOO_LARGE", "La solicitud es demasiado grande.");
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { throw invalidRequest(); }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) throw invalidRequest();
  return parsed as Record<string, unknown>;
}

function documentHash(body: Record<string, unknown>): string {
  if (typeof body.sha256Documento !== "string" || !SHA256.test(body.sha256Documento)) throw invalidRequest();
  return body.sha256Documento;
}

// El rechazo de cada ruta no distingue si el token existe, venció o ya se usó. No registrar tokens, códigos, hashes, correos ni imágenes.
async function respond(request: Request, action: string, run: (hash: string, ctx: RequestContext) => Promise<Response>): Promise<Response> {
  const requestId = randomUUID();
  try {
    if (request.method !== "POST") throw new PdfError(405, "METHOD_NOT_ALLOWED", "Esta operación requiere POST.");
    return await run(tokenHash(request), context(request));
  } catch (error) {
    const known = error instanceof PdfError;
    console.error("[signature-signer]", { requestId, action, code: known ? error.code : "UNEXPECTED", errorName: error instanceof Error ? error.name : "DatabaseOrStorageError" });
    return json({ error: { code: known ? error.code : "UNEXPECTED", message: known ? error.message : "No se pudo completar la operación. Vuelve a intentarlo o contacta a quien te envió la invitación." }, requestId }, known ? error.status : 500);
  }
}

export function handleSignerSessionRequest(request: Request, dependencies: SignerRequestDependencies) {
  return respond(request, "session", async (hash, ctx) => json(await dependencies.service().session(hash, ctx)));
}

export function handleSignerDocumentRequest(request: Request, dependencies: SignerRequestDependencies) {
  return respond(request, "document", async (hash, ctx) => {
    const { bytes, sha256 } = await dependencies.service().document(hash, ctx);
    return new Response(new Uint8Array(bytes), { status: 200, headers: { "Content-Type": "application/pdf", "Content-Length": String(bytes.length), "X-Content-SHA256": sha256, ...SECURITY_HEADERS } });
  });
}

export function handleSignerConsentRequest(request: Request, dependencies: SignerRequestDependencies) {
  return respond(request, "consent", async (hash, ctx) => {
    const body = await jsonBody(request);
    if (typeof body.version !== "string") throw invalidRequest();
    return json(await dependencies.service().consent({ tokenHash: hash, documentSha256: documentHash(body), version: body.version, accepted: body.acepta === true }, ctx));
  });
}

export function handleSignerCodeRequest(request: Request, dependencies: SignerRequestDependencies) {
  return respond(request, "code", async (hash, ctx) => json(await dependencies.service().requestCode(hash, ctx)));
}

// Un código incorrecto responde 200 con su resultado: 07 ya confirmó el intento y la interfaz muestra los restantes.
export function handleSignerSignRequest(request: Request, dependencies: SignerRequestDependencies) {
  return respond(request, "sign", async (hash, ctx) => {
    const body = await jsonBody(request);
    // Un código mal formado no puede ser correcto: no se gasta un intento en él.
    if (typeof body.codigo !== "string" || !/^\d{6}$/.test(body.codigo)) throw new PdfError(422, "OTP_MALFORMED", "Escribe el código de 6 dígitos.");
    return json(await dependencies.service().sign({ tokenHash: hash, code: body.codigo, documentSha256: documentHash(body), pngBase64: body.firmaPng, confirmed: body.confirmacion === true }, ctx));
  });
}
