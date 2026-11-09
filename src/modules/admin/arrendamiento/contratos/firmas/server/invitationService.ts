import { randomBytes } from "node:crypto";
import { PdfError } from "../../documentos/server/errors";
import { hashInvitationToken } from "./signerFlowService";

export const DEFAULT_INVITATION_HOURS = 72;

export interface InvitationRecord { firmante_id: string; emitida_at: string; expira_at: string; usada_at: string | null; revocada_at: string | null }

export interface InvitationRepository {
  processContract(processId: string): Promise<string | null>;
  emit(input: { actorId: string; processId: string; signerId: string; tokenHash: string; hours: number }): Promise<{ expira_at: string }>;
  // De consultar_evidencia_firma, ordenadas por emisión. Nunca incluyen el hash del token.
  invitations(actorId: string, processId: string): Promise<InvitationRecord[]>;
}

function invitationDatabaseError(cause: unknown): never {
  const code = typeof cause === "object" && cause !== null && "code" in cause ? String(cause.code) : "";
  const message = typeof cause === "object" && cause !== null && "message" in cause ? String(cause.message) : "";
  if (code === "42501") throw new PdfError(403, "FORBIDDEN", "Tu cuenta no tiene permisos de administrador para esta operación.", cause);
  if (code === "RF007") throw new PdfError(409, "SIGNER_EMAIL_MISSING", "El firmante no tiene un correo válido en el proceso. Es un dato obligatorio de la evidencia, aunque no se le envíe nada.", cause);
  if (/no pendiente/.test(message)) throw new PdfError(409, "PROCESS_NOT_PENDING", "El proceso de firma ya no está pendiente.", cause);
  if (/iniciado antes de la firma electrónica/.test(message)) throw new PdfError(409, "PROCESS_NOT_ELECTRONIC", "Este proceso se inició antes de la firma electrónica: cancélalo e inicia uno nuevo.", cause);
  if (/ya firmó/.test(message)) throw new PdfError(409, "SIGNER_ALREADY_SIGNED", "Este firmante ya firmó.", cause);
  if (/Firmante ajeno/.test(message)) throw new PdfError(404, "SIGNER_NOT_FOUND", "El firmante no pertenece a este proceso.", cause);
  throw cause;
}

function invitationStatus(invitation: InvitationRecord, now: number) {
  if (invitation.usada_at) return "USADA";
  if (invitation.revocada_at) return "REVOCADA";
  return new Date(invitation.expira_at).getTime() <= now ? "VENCIDA" : "VIGENTE";
}

// A la base solo llega el hash del token: el enlace existe únicamente en la respuesta que lo genera y no se puede volver a consultar.
export function createInvitationService(repository: InvitationRepository, siteUrl: () => string) {
  async function assertProcess(contractId: string, processId: string) {
    if (await repository.processContract(processId) !== contractId) throw new PdfError(404, "PROCESS_NOT_FOUND", "El proceso de firma no existe en este contrato.");
  }
  return {
    async issue(input: { actorId: string; contractId: string; processId: string; signerId: string; hours?: number }) {
      // La configuración se comprueba antes de emitir, para no revocar la invitación vigente sin poder entregar otra.
      const base = siteUrl();
      await assertProcess(input.contractId, input.processId);
      const token = randomBytes(32).toString("base64url");
      const issued = await repository.emit({ actorId: input.actorId, processId: input.processId, signerId: input.signerId, tokenHash: hashInvitationToken(token), hours: input.hours ?? DEFAULT_INVITATION_HOURS }).catch(invitationDatabaseError);
      // El token va en el fragmento: el navegador no lo envía en la URL, así que no queda en registros ni en Referer.
      return { enlace: `${new URL("/firmar", base).href}#t=${token}`, expiraAt: issued.expira_at };
    },
    // Estado de la última invitación de cada firmante, sin enlace ni token.
    async list(input: { actorId: string; contractId: string; processId: string }, now = Date.now()) {
      await assertProcess(input.contractId, input.processId);
      const latest = new Map((await repository.invitations(input.actorId, input.processId).catch(invitationDatabaseError)).map(invitation => [invitation.firmante_id, invitation]));
      return { invitaciones: [...latest.values()].map(invitation => ({ firmanteId: invitation.firmante_id, estado: invitationStatus(invitation, now), emitidaAt: invitation.emitida_at, expiraAt: invitation.expira_at })) };
    },
  };
}
