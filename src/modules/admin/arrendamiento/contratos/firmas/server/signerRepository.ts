import type { SupabaseClient } from "@supabase/supabase-js";
import type { InvitationRecord, InvitationRepository } from "./invitationService";
import type { SignerRepository, SignerSession } from "./signerFlowService";

// client: service_role. Solo RPC de 07: el token llega como hash y nunca se envía en claro a la base.
export function signerRepository(client: SupabaseClient): SignerRepository {
  return {
    async open(tokenHash, request) {
      const { data, error } = await client.rpc("abrir_invitacion_firma", { p_token_hash: tokenHash, p_ip: request.ip, p_user_agent: request.userAgent });
      if (error) throw error;
      return data as SignerSession;
    },
    async recordView(tokenHash, sha256, request) {
      const { error } = await client.rpc("registrar_visualizacion_firma", { p_token_hash: tokenHash, p_sha256_calculado: sha256, p_ip: request.ip, p_user_agent: request.userAgent });
      if (error) throw error;
    },
    async recordConsent(input, request) {
      const { error } = await client.rpc("registrar_consentimiento_firma", { p_token_hash: input.tokenHash, p_sha256_documento: input.documentSha256, p_version: input.version, p_acepta: input.accepted, p_ip: request.ip, p_user_agent: request.userAgent });
      if (error) throw error;
    },
    async issueOtp(tokenHash, otpHmac, request) {
      const { data, error } = await client.rpc("emitir_otp_firma", { p_token_hash: tokenHash, p_otp_hmac: otpHmac, p_ip: request.ip, p_user_agent: request.userAgent });
      if (error) throw error;
      return data as { expira_at: string; codigos_restantes: number };
    },
  };
}

export function invitationRepository(client: SupabaseClient): InvitationRepository {
  return {
    async processContract(processId) {
      const { data, error } = await client.from("procesos_firma").select("contrato_id").eq("id", processId).maybeSingle<{ contrato_id: string }>();
      if (error) throw error;
      return data?.contrato_id ?? null;
    },
    async emit(input) {
      const { data, error } = await client.rpc("emitir_invitacion_firma", { p_actor: input.actorId, p_proceso: input.processId, p_firmante: input.signerId, p_token_hash: input.tokenHash, p_vigencia_horas: input.hours });
      if (error) throw error;
      return data as { expira_at: string };
    },
    async invitations(actorId, processId) {
      const { data, error } = await client.rpc("consultar_evidencia_firma", { p_actor: actorId, p_proceso: processId });
      if (error) throw error;
      return (data as { invitaciones: InvitationRecord[] }).invitaciones;
    },
  };
}
