// infrastructure/mappers/mapToContract.ts
import { Contract } from "@/modules/realEstateBI/domain/entities/Contract"

export function mapToContract(row: any): Contract {
    return new Contract(
        row.id,
        row.unit_id,
        new Date(row.fecha_inicio),
        new Date(row.fecha_fin),
        row.renta_mensual
    )
}
