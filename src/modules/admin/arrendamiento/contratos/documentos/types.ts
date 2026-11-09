import type { ContractTemplateContext } from "../plantillas/types";

export interface ContractDocumentSummary {
  id: string;
  contrato_id: string;
  version_plantilla_id: string;
  numero_version: number;
  tipo: "BORRADOR" | "PARA_FIRMA" | "FIRMADO";
  estado: "GENERADO" | "ENVIADO" | "REEMPLAZADO" | "ANULADO";
  nombre_archivo: string;
  storage_path: string | null;
  generated_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ContractDocument extends ContractDocumentSummary {
  datos_snapshot: ContractTemplateContext | null;
  contenido_renderizado: string | null;
}

export interface NewContractDocument {
  contrato_id: string;
  version_plantilla_id: string;
  numero_version: number;
  nombre_archivo: string;
  datos_snapshot: ContractTemplateContext;
  contenido_renderizado: string;
}
