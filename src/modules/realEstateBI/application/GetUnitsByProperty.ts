// application/usecases/GetUnitsByProperty.ts
import type { UnitRepository } from "@/modules/realEstateBI/domain/repositories/UnitRepository";
import type { UnitDetailsDto } from "@/modules/realEstateBI/application/dtos/UnitDetailsDto";

export class GetUnitsByProperty {
    constructor(private readonly unitRepository: UnitRepository) { }

    async execute(propertyId: string): Promise<UnitDetailsDto[]> {
        return this.unitRepository.findByProperty(propertyId);
    }
}
