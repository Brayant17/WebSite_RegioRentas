export interface SignerSessionView {
  folio: string | null; nombreFirmante: string; nombreEntidad: string; rol: string; caracter: string; correoParcial: string; expiraAt: string;
  sha256Documento: string; consentimientoVersion: string; consentimientoTexto: string; visualizado: boolean; consentido: boolean; otpExpiraAt: string | null; codigoDisponible: boolean;
}
export interface CodeIssued { expiraAt: string; codigosRestantes: number }
export type SignResult =
  | { resultado: "FIRMADO"; firmadoAt: string; sha256Documento: string; sha256Firma: string; sha256Evidencia: string; firmantesPendientes: number; finalizacion: "NO_REQUERIDA" | "COMPLETADA" | "PENDIENTE" }
  | { resultado: "OTP_INCORRECTO" | "OTP_VENCIDO" | "OTP_AGOTADO" | "OTP_INEXISTENTE"; intentosRestantes: number };

export class SignerRequestError extends Error {
  code: string;
  constructor(code: string, message: string) { super(message); this.name = "SignerRequestError"; this.code = code; }
}

// El token va en el fragmento del enlace: el navegador no lo envía al cargar la página.
export function readInvitationToken(hash: string = window.location.hash): string | null {
  return new URLSearchParams(hash.replace(/^#/, "")).get("t");
}

async function call(path: string, token: string, body?: object): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(`/api/firma/${path}`, { method: "POST", cache: "no-store", credentials: "omit", referrerPolicy: "no-referrer",
      headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  } catch {
    throw new SignerRequestError("NETWORK", "No hay conexión con el servidor. Revisa tu internet y vuelve a intentarlo.");
  }
  if (response.ok) return response;
  const data = await response.json().catch(() => null);
  throw new SignerRequestError(data?.error?.code ?? "UNEXPECTED", data?.error?.message ?? "No se pudo completar la operación. Vuelve a intentarlo.");
}
const callJson = async <T>(path: string, token: string, body?: object): Promise<T> => (await call(path, token, body)).json();

export const openSession = (token: string) => callJson<SignerSessionView>("sesion", token);

async function sha256Of(bytes: Uint8Array): Promise<string | null> {
  if (!globalThis.crypto?.subtle) return null;
  const digest = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}

// Comprueba también en el navegador que lo recibido es exactamente el documento del proceso.
export async function fetchDocument(token: string, expectedSha256: string): Promise<Uint8Array> {
  const bytes = new Uint8Array(await (await call("documento", token)).arrayBuffer());
  const actual = await sha256Of(bytes);
  if (actual && actual !== expectedSha256) throw new SignerRequestError("DOCUMENT_MISMATCH", "El documento recibido no coincide con el del proceso. No continúes y avisa a quien te envió la invitación.");
  return bytes;
}

export const acceptConsent = (token: string, sha256Documento: string, version: string) => callJson<{ consentido: true }>("consentimiento", token, { sha256Documento, version, acepta: true });
export const requestCode = (token: string) => callJson<CodeIssued>("codigo", token);
export const submitSignature = (token: string, input: { codigo: string; sha256Documento: string; firmaPng: string }) =>
  callJson<SignResult>("firmar", token, { ...input, confirmacion: true });
