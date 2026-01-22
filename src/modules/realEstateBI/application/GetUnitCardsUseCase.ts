// application/usecases/GetUnitCardsUseCase.ts
import type { UnitRepository, UnitFilter } from "@/modules/realEstateBI/domain/repositories/UnitRepository";

export class GetUnitCardsUseCase {
    constructor(private readonly repo: UnitRepository) { }

    async execute(propertyId: string, filter: UnitFilter) {
        return this.repo.getUnitCards(propertyId, filter);
    }
}
