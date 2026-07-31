import type { Unit } from "../../types/unit.type";
import type { UnitDTO } from "../dtos/create-unitUI-dto";


function formatDate(date: string) {
  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(date));
}


export function toCreateUnitUiDto(unit: Unit): UnitDTO{
    return {
        id: unit.id,
        name: unit.name,
        floor: unit.floor,
        location: unit.location,
        bedrooms: unit.bedrooms,
        area: unit.area,
        status: "Disponible",
        tenant: null,
        suggestedRent: unit.suggestedRent,
        vacantSince: `vacio desde ${formatDate(unit.vacantSince)}`
    }
}