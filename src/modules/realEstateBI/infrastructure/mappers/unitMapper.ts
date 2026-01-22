// infrastructure/supabase/mappers/unitMapper.ts
import { Unit, type UnitStatus } from "@/modules/realEstateBI/domain/entities/Unit";

export function mapUnitFromDb(row: any): Unit {
    return new Unit(
        row.id,
        row.rental_property_id,
        row.codigo,
        row.nombre,
        row.precio_renta,
        row.estado as UnitStatus,
        row.activo,
        new Date(row.created_at),
        new Date(row.updated_at)
    )
}

export function mapUnitToDb(unit: Unit) {
    return {
        rental_property_id: unit.getPropertyID(),
        codigo: unit.getCode(),
        nombre: unit.getName(),
        precio_renta: unit.monthlyRent,
        estado: unit.status,
        activo: unit.isActive
    }
}
