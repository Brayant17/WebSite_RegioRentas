import type { Unit } from "../../types/Unit";
import type { UnitDTO } from "../view-models/UnitCardViewModel";

function formatDate(date: string) {
  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(date));
}

export function toUnitCardViewModel(unit: Unit): UnitDTO{
    return {
        id: unit.id,
        name: unit.nombre,
        floor: String(unit.piso),
        location: unit.ubicacion,
        bedrooms: unit.recamaras,
        area: unit.area,
        status: "Disponible",
        tenant: null,
        suggestedRent: Number(unit.precio_renta),
        vacantSince: `Vacío hace ${formatDate(unit.created_at)}`
    }
}