import type { SupabaseClient } from "@supabase/supabase-js";
import type { SignatureDocument, SignatureRepository, SignatureStarter } from "./signatureService";
import type { SignatureSources } from "./sources";
import type { CancellationRepository } from "./cancellationService";

// client: service_role (EXECUTE de las RPC de verificación 2C). Sin escrituras directas a tablas.
export function signatureRepository(client: SupabaseClient): SignatureRepository {
  return {
    async sources(contractId) {
      const { data, error } = await client.rpc("firma_fuentes_para_verificar", { p_contrato: contractId });
      if (error) throw error;
      return data as SignatureSources | null;
    },
    async document(contractId, documentId) {
      const { data, error } = await client.from("documentos_contrato")
        .select("id, contrato_id, version_plantilla_id, tipo, estado, nombre_archivo, storage_path, datos_snapshot, contenido_renderizado")
        .eq("id", documentId).eq("contrato_id", contractId).maybeSingle<SignatureDocument>();
      if (error) throw error;
      return data;
    },
    async templateContent(versionId) {
      const { data, error } = await client.from("versiones_plantilla").select("contenido").eq("id", versionId).maybeSingle<{ contenido: string | null }>();
      if (error) throw error;
      return data?.contenido ?? null;
    },
    async registerValidation(input) {
      const { data, error } = await client.rpc("registrar_validacion_documento_firma", {
        p_actor: input.actorId, p_contrato: input.contractId, p_documento: input.documentId,
        p_pdf_sha256: input.pdfSha256, p_pdf_bytes: input.pdfBytes, p_fuentes: input.sources,
        p_contexto_reconstruido: input.context, p_html_sha256: input.htmlSha256, p_plantilla_sha256: input.templateSha256,
        p_revision_renderer: input.rendererRevision, p_identidades: input.identities,
      });
      if (error) throw error;
      return data as string;
    },
  };
}

// client: sesión del administrador. RLS (lectura admin) y cancelar_proceso_firma (admin_actual) deciden.
export function cancellationRepository(client: SupabaseClient): CancellationRepository {
  return {
    async process(processId) {
      const { data, error } = await client.from("procesos_firma").select("id, contrato_id, estado").eq("id", processId)
        .maybeSingle<{ id: string; contrato_id: string; estado: string }>();
      if (error) throw error;
      return data;
    },
    async cancel(processId, reason) {
      const { error } = await client.rpc("cancelar_proceso_firma", { p_proceso: processId, p_motivo: reason });
      if (error) throw error;
    },
  };
}

// client: sesión del administrador (rol authenticated); la RPC valida auth.uid() y su rol admin.
export function signatureStarter(client: SupabaseClient): SignatureStarter {
  return {
    async start({ contractId, documentId, pdfSha256, validationId }) {
      const { data, error } = await client.rpc("iniciar_proceso_firma", {
        p_contrato: contractId, p_documento: documentId, p_sha256: pdfSha256, p_validacion: validationId,
      });
      if (error) throw error;
      return data as string;
    },
  };
}
