import { contractPath } from "../../components/ContractShared";

export const documentPath = (contractId: string, documentId: string) => `${contractPath(contractId)}/documentos/${encodeURIComponent(documentId)}`;

export function documentGeneratedAt(value: string | null): string {
  if (!value) return "Sin fecha de generación";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Fecha no disponible";
  return new Intl.DateTimeFormat("es-MX", { dateStyle: "short", timeStyle: "short", timeZone: "America/Mexico_City" }).format(date);
}
