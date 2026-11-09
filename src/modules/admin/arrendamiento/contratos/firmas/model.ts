import type { ContractDocumentSummary } from "../documentos/types";

// Solo orienta la interfaz; la elegibilidad real la deciden el servidor y las RPC 2C.
export function canStartSignature(contractStatus: string | undefined, document: Pick<ContractDocumentSummary, "tipo" | "estado" | "storage_path">): boolean {
  return contractStatus === "BORRADOR" && document.estado === "GENERADO" && (document.tipo === "BORRADOR" || document.tipo === "PARA_FIRMA") && Boolean(document.storage_path);
}
