import type { SupabaseClient } from "@supabase/supabase-js";
import type { FinalPdfData } from "./finalPdf";
import type { FinalPdfRepository } from "./finalPdfService";
import type { SigningRepository } from "./signingService";

// client: service_role. Solo RPC de 07, salvo el folio del contrato para la constancia.
export function finalPdfRepository(client: SupabaseClient): FinalPdfRepository {
  return {
    async pendingProcesses(limit) {
      const { data, error } = await client.rpc("listar_procesos_por_finalizar", { p_limite: limit });
      if (error) throw error;
      return data as string[];
    },
    async data(processId) {
      const { data, error } = await client.rpc("datos_pdf_final_firma", { p_proceso: processId });
      if (error) throw error;
      return data as FinalPdfData;
    },
    async folio(contractId) {
      const { data, error } = await client.from("contratos").select("folio").eq("id", contractId).maybeSingle<{ folio: string | null }>();
      if (error) throw error;
      return data?.folio ?? null;
    },
    async register(input) {
      const { data, error } = await client.rpc("registrar_pdf_final_firma", {
        p_proceso: input.processId, p_sha256_documento_origen: input.originSha256, p_sha256_manifiesto: input.manifestSha256,
        p_sha256_final: input.finalSha256, p_size_bytes: input.sizeBytes, p_generador: input.generator,
      });
      if (error) throw error;
      return data as { pdf_final_id: string; sha256: string; ya_registrado: boolean };
    },
    async registeredPdf(actorId, processId) {
      const { data, error } = await client.rpc("consultar_evidencia_firma", { p_actor: actorId, p_proceso: processId });
      if (error) throw error;
      return (data as { pdf_final: { contrato_id: string; storage_path: string; sha256: string; size_bytes: number } | null }).pdf_final;
    },
  };
}

export function signingRepository(client: SupabaseClient): SigningRepository {
  return {
    async sign(input) {
      const { data, error } = await client.rpc("firmar_documento_electronico", {
        p_token_hash: input.tokenHash, p_otp_hmac: input.otpHmac, p_sha256_documento: input.documentSha256, p_firma_png_base64: input.pngBase64,
        p_sha256_firma: input.pngSha256, p_confirma_firma: input.confirmed, p_ip: input.ip, p_user_agent: input.userAgent,
      });
      if (error) throw error;
      return data;
    },
  };
}
