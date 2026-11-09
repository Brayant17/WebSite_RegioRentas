export interface PdfSourceDocument {
  id: string;
  contrato_id: string;
  nombre_archivo: string;
  storage_path: string | null;
  contenido_renderizado: string | null;
  datos_snapshot?: unknown;
}

export interface PdfDocumentRepository {
  get(contractId: string, documentId: string): Promise<PdfSourceDocument | null>;
  attachPath(contractId: string, documentId: string, path: string): Promise<boolean>;
}

export interface PdfStorage {
  assertPrivateBucket(): Promise<void>;
  hasPdf(path: string): Promise<boolean>;
  upload(path: string, bytes: Uint8Array): Promise<void>;
  signedUrl(path: string, downloadName?: string): Promise<string>;
  download(path: string): Promise<Uint8Array>;
}

export type PdfGenerator = (html: string, options?: { folio: string }) => Promise<Uint8Array>;
