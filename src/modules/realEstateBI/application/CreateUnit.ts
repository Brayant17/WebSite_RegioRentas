// application/CreateUnit

import { Unit } from "../domain/entities/Unit";
import type { UnitRepository } from "../domain/repositories/UnitRepository";
import type { CreateUnitInput } from "./dtos/CreateUnitInput";

export class CreateUnit {
    constructor(private readonly unitRepository: UnitRepository) { }

    async execute(input: CreateUnitInput) {
        const unit = new Unit({
            id: crypto.randomUUID(),
            propertyId: input.propertyId,
            code: input.code,
            name: input.name,
            type: input.type,
            floor: input.floor,
            areaM2: input.areaM2,
            bedrooms: input.bedrooms,
            bathrooms: input.bathrooms,
            parkingSpots: input.parkingSpots,
            furnished: input.furnished,
            description: input.description,
            monthlyRent: input.rentPrice,
            currency: "MXN",
            status: "Disponible",
            isActive: true,
        });

        await this.unitRepository.save(unit);
    }
}