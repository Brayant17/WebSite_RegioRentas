import type { SupabaseClient } from "@supabase/supabase-js";
import type { PdfDocumentRepository, PdfSourceDocument } from "./types";

export function pdfDocumentRepository(client: SupabaseClient): PdfDocumentRepository {
  return {
    async get(contractId, documentId) {
      const { data, error } = await client.from("documentos_contrato")
        .select("id, contrato_id, nombre_archivo, storage_path, contenido_renderizado, datos_snapshot")
        .eq("id", documentId).eq("contrato_id", contractId).maybeSingle<PdfSourceDocument>();
      if (error) throw error;
      return data;
    },
    async attachPath(contractId, documentId, path) {
      const { data, error } = await client.from("documentos_contrato").update({ storage_path: path })
        .eq("id", documentId).eq("contrato_id", contractId).is("storage_path", null)
        .select("id").maybeSingle<{ id: string }>();
      if (error) throw error;
      return Boolean(data);
    },
  };
}
