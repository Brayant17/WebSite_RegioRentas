// infrastructure/mappers/mapUnitRecordToDetailsDto.ts
import type { UnitRecordDto } from "@/modules/realEstateBI/application/dtos/UnitRecordDto";
import type { UnitDetailsDto } from "@/modules/realEstateBI/application/dtos/UnitDetailsDto";

export function mapUnitRecordToDetailsDto(
    record: UnitRecordDto
): UnitDetailsDto {
    return {
        id: record.id,
        propertyId: record.rental_property_id,
        code: record.codigo,
        name: record.nombre,
        type: record.tipo,
        floor: record.piso,
        areaM2: record.area_m2,
        bedrooms: record.recamaras,
        bathrooms: record.banos,
        parkingSpots: record.estacionamientos,
        furnished: record.amueblado,
        rentPrice: record.precio_renta,
        currency: record.moneda,
        description: record.descripcion,
        status: record.estado
    };
}
