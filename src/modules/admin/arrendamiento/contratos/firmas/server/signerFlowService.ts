import { createHash, createHmac, randomInt } from "node:crypto";
import { PdfError } from "../../documentos/server/errors";
import { sha256Hex } from "./finalPdf";
import type { OtpDelivery } from "./otpDelivery";
import { signingError, type createSigningService } from "./signingService";

export interface RequestContext { ip: string | null; userAgent: string | null }

// Forma de abrir_invitacion_firma (07).
export interface SignerSession {
  invitacion_id: string; proceso_id: string; firmante_id: string; contrato_id: string; documento_id: string; storage_path: string;
  folio: string | null; sha256_documento: string; size_bytes: number; nombre_firmante: string; nombre_entidad: string; rol: string; caracter: string;
  correo_parcial: string; expira_at: string; consentimiento_version: string; consentimiento_texto: string; visualizado: boolean; consentido: boolean; otp_expira_at: string | null;
}

export interface SignerRepository {
  open(tokenHash: string, request: RequestContext): Promise<SignerSession>;
  recordView(tokenHash: string, sha256: string, request: RequestContext): Promise<void>;
  recordConsent(input: { tokenHash: string; documentSha256: string; version: string; accepted: boolean }, request: RequestContext): Promise<void>;
  issueOtp(tokenHash: string, otpHmac: string, request: RequestContext): Promise<{ expira_at: string; codigos_restantes: number }>;
}

export const hashInvitationToken = (token: string) => createHash("sha256").update(token).digest("hex");
// Debe coincidir con 07: HMAC-SHA256(secreto_servidor, invitacion_id || ':' || otp).
export const otpHmac = (secret: string, invitationId: string, code: string) => createHmac("sha256", secret).update(`${invitationId}:${code}`).digest("hex");
const newOtp = () => String(randomInt(0, 1_000_000)).padStart(6, "0");

export interface SignerFlowDependencies {
  repository: SignerRepository;
  storage: { download(path: string): Promise<Uint8Array> };
  signing: Pick<ReturnType<typeof createSigningService>, "submit">;
  // Se leen solo donde hacen falta, para que una configuración incompleta no gaste códigos.
  otpSecret(): string;
  // null: este entorno no tiene canal para entregar códigos.
  otpDelivery(): OtpDelivery | null;
}

// Lo que el navegador del firmante puede ver: sin rutas de Storage ni identificadores internos.
function publicSession(session: SignerSession, codigoDisponible: boolean) {
  return {
    folio: session.folio, nombreFirmante: session.nombre_firmante, nombreEntidad: session.nombre_entidad, rol: session.rol, caracter: session.caracter,
    correoParcial: session.correo_parcial, expiraAt: session.expira_at, sha256Documento: session.sha256_documento, consentimientoVersion: session.consentimiento_version,
    consentimientoTexto: session.consentimiento_texto, visualizado: session.visualizado, consentido: session.consentido, otpExpiraAt: session.otp_expira_at, codigoDisponible,
  };
}

// Cada paso resuelve el token con abrir_invitacion_firma, la única RPC que lo hace; por eso 07 registra un INVITACION_ABIERTA por petición.
export function createSignerFlowService(dependencies: SignerFlowDependencies) {
  const { repository, storage, signing } = dependencies;
  const open = (tokenHash: string, request: RequestContext) => repository.open(tokenHash, request).catch(signingError);
  return {
    async session(tokenHash: string, request: RequestContext) {
      return publicSession(await open(tokenHash, request), dependencies.otpDelivery() !== null);
    },
    // La visualización se registra con el hash de los bytes que se van a entregar; si no coincide con el proceso, 07 lo rechaza y el PDF no sale.
    async document(tokenHash: string, request: RequestContext) {
      const session = await open(tokenHash, request);
      const bytes = await storage.download(session.storage_path).catch(cause => { throw new PdfError(500, "DOCUMENT_UNAVAILABLE", "No se pudo cargar el documento. Vuelve a intentarlo.", cause); });
      const sha256 = sha256Hex(bytes);
      await repository.recordView(tokenHash, sha256, request).catch(signingError);
      return { bytes, sha256 };
    },
    async consent(input: { tokenHash: string; documentSha256: string; version: string; accepted: boolean }, request: RequestContext) {
      await repository.recordConsent(input, request).catch(signingError);
      return { consentido: true };
    },
    // El código nunca vuelve en la respuesta. Sin canal de entrega se rechaza antes de emitir, para no gastar códigos.
    async requestCode(tokenHash: string, request: RequestContext) {
      const secret = dependencies.otpSecret();
      const delivery = dependencies.otpDelivery();
      if (!delivery) throw new PdfError(503, "OTP_CHANNEL_UNAVAILABLE", "La verificación por código no está disponible en este entorno. No se generó ningún código.");
      const session = await open(tokenHash, request);
      const code = newOtp();
      const issued = await repository.issueOtp(tokenHash, otpHmac(secret, session.invitacion_id, code), request).catch(signingError);
      delivery.deliver({ folio: session.folio, correoParcial: session.correo_parcial, code, expiresAt: issued.expira_at });
      return { expiraAt: issued.expira_at, codigosRestantes: issued.codigos_restantes };
    },
    async sign(input: { tokenHash: string; code: string; documentSha256: string; pngBase64: unknown; confirmed: boolean }, request: RequestContext) {
      const secret = dependencies.otpSecret();
      const session = await open(input.tokenHash, request);
      const result = await signing.submit({ processId: session.proceso_id, tokenHash: input.tokenHash, otpHmac: otpHmac(secret, session.invitacion_id, input.code),
        documentSha256: input.documentSha256, pngBase64: input.pngBase64, confirmed: input.confirmed, ip: request.ip, userAgent: request.userAgent });
      if (result.resultado !== "FIRMADO") return { resultado: result.resultado, intentosRestantes: result.intentos_restantes };
      return { resultado: result.resultado, firmadoAt: result.firmado_at, sha256Documento: input.documentSha256, sha256Firma: result.sha256_firma, sha256Evidencia: result.sha256_evidencia,
        firmantesPendientes: result.firmantes_pendientes, finalizacion: result.finalizacion };
    },
  };
}
