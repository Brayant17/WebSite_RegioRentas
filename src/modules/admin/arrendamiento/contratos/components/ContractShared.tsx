import { Button } from "@/components/ui/button";
import type { ContractPerson } from "../types";

export const contractsPath = "/admin/arrendamiento/contratos";
export const contractPath = (id: string) => `${contractsPath}/${encodeURIComponent(id)}`;
export const personName = (person: ContractPerson | null) => person ?
  [person.nombre, person.apellido_paterno, person.apellido_materno].filter(Boolean).join(" ") || "Sin nombre" : "Persona no disponible";
export const money = (value: number | string | null) => value === null || String(value).trim() === "" || !Number.isFinite(Number(value)) ? "Sin dato" :
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(Number(value));
export const dateLabel = (value: string | null) => value ? value.split("-").reverse().join("/") : "Sin dato";

export function ContractQueryError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <div className="space-y-3 rounded-lg border p-4">
    <p role="alert" className="text-sm text-destructive">{message}</p>
    <Button variant="outline" onClick={onRetry}>Actualizar consulta</Button>
  </div>;
}
