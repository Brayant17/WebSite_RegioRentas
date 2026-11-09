import { loadContractTemplatePreview } from "../../plantillas/services/template.service";
import * as repository from "../repositories/documentos.repository";

export function documentErrorMessage(error: unknown): string {
  const code = typeof error === "object" && error !== null && "code" in error ? error.code : null;
  const message = error instanceof Error ? error.message : typeof error === "object" && error !== null && "message" in error && typeof error.message === "string" ? error.message : "";
  if (code === "23505") return "Otra generación utilizó la misma revisión del documento. Actualiza el listado y vuelve a generar para obtener una nueva versión.";
  if (code === "42501" || /row-level security|permission denied/i.test(message)) return "No tienes permisos suficientes para documentos del contrato. Se necesitan permisos SELECT e INSERT para administradores sobre documentos_contrato; revisa las policies RLS.";
  if (code === "PGRST301" || code === "PGRST303" || /jwt|session expired/i.test(message)) return "Tu sesión expiró. Ingresa nuevamente como administrador.";
  if (/fetch|network/i.test(message)) return "No se pudo confirmar la operación por un problema de conexión. Consulta el listado de documentos antes de volver a generar para evitar duplicados.";
  if (error instanceof Error) return message;
  return "No se pudo completar la operación de documentos. Revisa los permisos y el listado antes de volver a intentarlo.";
}

export function documentFilename(folio: string, revision: number): string {
  if (!Number.isInteger(revision) || revision < 1 || revision > 2147483647) throw new Error("La revisión del documento no es válida.");
  const safeFolio = folio.normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 100) || "contrato";
  return `${safeFolio}-v${revision}.pdf`;
}

export async function generateContractDocument(contractId: string, selectedVersionId: string) {
  if (!selectedVersionId) throw new Error("Selecciona la versión de plantilla antes de generar.");
  // Recarga datos actuales; el ID de versión se conserva. Snapshot y HTML salen del mismo render.
  const prepared = await loadContractTemplatePreview(contractId, selectedVersionId);
  if (prepared.version.id !== selectedVersionId) throw new Error("La versión consultada no coincide con la seleccionada.");
  if (prepared.unresolvedVariables.length) throw new Error(`No se puede generar: hay variables desconocidas en la plantilla: ${prepared.unresolvedVariables.join(", ")}.`);
  if (!prepared.html.trim()) throw new Error("No se puede generar un documento con HTML vacío.");
  const revision = await repository.getNextDocumentVersion(contractId);
  const document = await repository.insertContractDocument({
    contrato_id: contractId,
    version_plantilla_id: selectedVersionId,
    numero_version: revision,
    nombre_archivo: documentFilename(prepared.context.contrato.folio, revision),
    datos_snapshot: structuredClone(prepared.context),
    contenido_renderizado: prepared.html,
  });
  return { document, emptyFields: prepared.emptyFields };
}

export const listContractDocuments = repository.getContractDocuments;

export async function loadHistoricalDocument(contractId: string, documentId: string) {
  // Histórico: únicamente documentos_contrato; nunca se consulta ni se renderiza el contexto actual.
  const document = await repository.getContractDocument(contractId, documentId);
  if (!document) throw new Error("El documento no existe, no pertenece a este contrato o no tienes permiso para consultarlo.");
  if (document.contrato_id !== contractId) throw new Error("El documento no pertenece al contrato de esta dirección.");
  if (!document.contenido_renderizado?.trim()) throw new Error("Este documento no tiene contenido HTML histórico disponible.");
  return document;
}
