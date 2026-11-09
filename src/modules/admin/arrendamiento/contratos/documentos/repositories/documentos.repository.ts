import { supabase } from "@/lib/supabaseClient";
import type { ContractDocument, ContractDocumentSummary, NewContractDocument } from "../types";

const summarySelect = "id, contrato_id, version_plantilla_id, numero_version, tipo, estado, nombre_archivo, storage_path, generated_at, created_at, updated_at";

export async function getNextDocumentVersion(contractId: string): Promise<number> {
  const { data, error } = await supabase.from("documentos_contrato").select("numero_version")
    .eq("contrato_id", contractId).order("numero_version", { ascending: false }).limit(1)
    .maybeSingle<{ numero_version: number }>();
  if (error) throw error;
  if (!data) return 1;
  if (!Number.isInteger(data.numero_version) || data.numero_version < 1 || data.numero_version >= 2147483647) {
    throw new Error("No se pudo determinar una nueva revisión válida del documento.");
  }
  return data.numero_version + 1;
}

export async function insertContractDocument(document: NewContractDocument): Promise<ContractDocumentSummary> {
  const { data, error } = await supabase.from("documentos_contrato").insert({
    contrato_id: document.contrato_id,
    version_plantilla_id: document.version_plantilla_id,
    numero_version: document.numero_version,
    tipo: "BORRADOR",
    estado: "GENERADO",
    nombre_archivo: document.nombre_archivo,
    storage_path: null,
    datos_snapshot: document.datos_snapshot,
    contenido_renderizado: document.contenido_renderizado,
    // Literal de entrada timestamptz: PostgreSQL lo resuelve al inicio de la transacción.
    generated_at: "now",
  }).select(summarySelect).single<ContractDocumentSummary>();
  if (error) throw error;
  if (!data) throw new Error("No se pudo confirmar el documento generado. Revisa el listado antes de volver a generar.");
  return data;
}

export async function getContractDocuments(contractId: string): Promise<ContractDocumentSummary[]> {
  const { data, error } = await supabase.from("documentos_contrato").select(summarySelect)
    .eq("contrato_id", contractId).order("numero_version", { ascending: false }).returns<ContractDocumentSummary[]>();
  if (error) throw error;
  return data ?? [];
}

export async function getContractDocument(contractId: string, documentId: string): Promise<ContractDocument | null> {
  const { data, error } = await supabase.from("documentos_contrato")
    .select(`${summarySelect}, datos_snapshot, contenido_renderizado`)
    .eq("id", documentId).eq("contrato_id", contractId).maybeSingle<ContractDocument>();
  if (error) throw error;
  return data;
}
