import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { PdfError } from "../../documentos/server/errors";
import { pdfStoragePath, validatePdfIds } from "../../documentos/server/paths";
import type { PdfStorage } from "../../documentos/server/types";
import { buildContractTemplateContext } from "../../plantillas/services/context.service";
import { renderContractTemplate } from "../../plantillas/renderer";
import type { ContractTemplateContext } from "../../plantillas/types";
import { contextSourceFromSources, identitiesFromSources, type SignatureSources, type SignerIdentity } from "./sources";

export interface SignatureDocument {
  id: string;
  contrato_id: string;
  version_plantilla_id: string | null;
  tipo: string;
  estado: string;
  nombre_archivo: string;
  storage_path: string | null;
  datos_snapshot: unknown;
  contenido_renderizado: string | null;
}

export interface SignatureValidationInput {
  actorId: string;
  contractId: string;
  documentId: string;
  pdfSha256: string;
  pdfBytes: number;
  sources: SignatureSources;
  context: unknown;
  htmlSha256: string;
  templateSha256: string;
  rendererRevision: string;
  identities: SignerIdentity[];
}

// Cliente service_role: lecturas y recibo. Nunca inicia el proceso.
export interface SignatureRepository {
  sources(contractId: string): Promise<SignatureSources | null>;
  document(contractId: string, documentId: string): Promise<SignatureDocument | null>;
  templateContent(versionId: string): Promise<string | null>;
  registerValidation(input: SignatureValidationInput): Promise<string>;
}

// Cliente con el JWT del administrador: iniciar_proceso_firma exige auth.uid() = actor del recibo.
export interface SignatureStarter {
  start(input: { contractId: string; documentId: string; pdfSha256: string; validationId: string }): Promise<string>;
}

export type SignatureStorage = Pick<PdfStorage, "assertPrivateBucket" | "hasPdf" | "download">;

const MAX_PDF_BYTES = 10 * 1024 * 1024;
const sha256 = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");

export function signatureDatabaseError(cause: unknown): never {
  const code = typeof cause === "object" && cause !== null && "code" in cause ? String(cause.code) : "";
  const message = typeof cause === "object" && cause !== null && "message" in cause ? String(cause.message) : "";
  if (code === "42501") throw new PdfError(403, "FORBIDDEN", "Tu cuenta no tiene permisos de administrador para esta operación de firma.", cause);
  // Excepciones explícitas de 2C (RAISE EXCEPTION): mensajes de negocio sin datos sensibles.
  if (code === "P0001" && message) throw new PdfError(409, "SIGNATURE_REJECTED", message, cause);
  throw cause;
}

export function createSignatureService(repository: SignatureRepository, storage: SignatureStorage, starter: SignatureStarter) {
  return {
    async start(actorId: string, contractId: string, documentId: string) {
      const ids = validatePdfIds(contractId, documentId);
      const document = await repository.document(ids.contractId, ids.documentId);
      if (!document || document.contrato_id !== ids.contractId) throw new PdfError(404, "DOCUMENT_NOT_FOUND", "El documento no existe o no pertenece a este contrato.");
      if (document.estado !== "GENERADO" || !["BORRADOR", "PARA_FIRMA"].includes(document.tipo)) {
        throw new PdfError(409, "DOCUMENT_NOT_ELIGIBLE", "Solo un documento GENERADO de tipo BORRADOR (o PARA_FIRMA de un proceso cancelado) puede enviarse a firma.");
      }
      if (!document.version_plantilla_id || !document.contenido_renderizado?.trim()) throw new PdfError(409, "DOCUMENT_INCOMPLETE", "El documento no tiene versión de plantilla o contenido HTML histórico.");
      const path = pdfStoragePath(document.contrato_id, document.id, document.nombre_archivo);
      if (document.storage_path !== path) throw new PdfError(409, "PDF_NOT_GENERATED", "Genera el PDF del documento antes de iniciar la firma.");

      const sources = await repository.sources(ids.contractId).catch(signatureDatabaseError);
      if (!sources) throw new PdfError(404, "CONTRACT_NOT_FOUND", "El contrato no existe.");
      if (sources.contrato.estado !== "BORRADOR") throw new PdfError(409, "CONTRACT_NOT_DRAFT", "Solo se puede iniciar la firma de un contrato en BORRADOR.");

      // Reconstrucción en servidor desde las fuentes actuales y la versión congelada del documento.
      let context: ContractTemplateContext;
      try { context = JSON.parse(JSON.stringify(buildContractTemplateContext(contextSourceFromSources(sources)))); }
      catch (cause) { throw new PdfError(422, "CONTEXT_INVALID", cause instanceof Error ? cause.message : "No se pudo reconstruir el contexto del contrato.", cause); }
      const template = await repository.templateContent(document.version_plantilla_id);
      if (!template?.trim()) throw new PdfError(409, "TEMPLATE_UNAVAILABLE", "La versión de plantilla del documento no está disponible.");
      const rendered = renderContractTemplate(template, context);
      if (rendered.unresolvedVariables.length) throw new PdfError(422, "TEMPLATE_UNRESOLVED", "La plantilla contiene variables desconocidas.");
      const htmlSha256 = sha256(rendered.html);
      if (!isDeepStrictEqual(context, document.datos_snapshot) || htmlSha256 !== sha256(document.contenido_renderizado)) {
        throw new PdfError(409, "DOCUMENT_OUTDATED", "Los datos del contrato cambiaron desde que se generó este documento. Genera una nueva revisión y su PDF antes de iniciar la firma.");
      }
      const rendererRevision = context.arrendador.bloques?.revision;
      if (typeof rendererRevision !== "string" || !rendererRevision) throw new PdfError(422, "RENDERER_REVISION_MISSING", "El documento no registra la revisión de bloques del arrendador.");
      const identities = identitiesFromSources(sources);

      // Bytes exactos del objeto privado: el hash se calcula aquí, nunca se acepta del navegador.
      await storage.assertPrivateBucket();
      if (!await storage.hasPdf(path)) throw new PdfError(409, "PDF_OBJECT_MISSING", "El archivo PDF no está disponible. Requiere revisión administrativa.");
      const bytes = await storage.download(path);
      if (bytes.byteLength < 1 || bytes.byteLength > MAX_PDF_BYTES || Buffer.from(bytes.subarray(0, 5)).toString() !== "%PDF-") {
        throw new PdfError(409, "INVALID_PDF", "El objeto almacenado no es un PDF válido dentro del límite de 10 MB.");
      }
      const pdfSha256 = sha256(bytes);

      if (!isDeepStrictEqual(await repository.sources(ids.contractId).catch(signatureDatabaseError), sources)) {
        throw new PdfError(409, "SOURCES_CHANGED", "Los datos del contrato cambiaron durante la verificación. Vuelve a intentarlo.");
      }
      const validationId = await repository.registerValidation({
        actorId, contractId: ids.contractId, documentId: ids.documentId, pdfSha256, pdfBytes: bytes.byteLength, sources, context,
        htmlSha256, templateSha256: sha256(template), rendererRevision, identities,
      }).catch(signatureDatabaseError);
      const processId = await starter.start({ contractId: ids.contractId, documentId: ids.documentId, pdfSha256, validationId }).catch(signatureDatabaseError);
      return { procesoId: processId };
    },
  };
}
