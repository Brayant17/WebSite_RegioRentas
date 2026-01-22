import type { UnitRepository } from "../domain/repositories/UnitRepository";
import { RentalContract } from "../domain/entities/RentalContract";
import type { RentalContractRepository } from "../domain/repositories/RentalContractRepository";
import { Unit } from "../domain/entities/Unit";

export interface OccupyUnitInput {
    unitId: string;
    startDate: Date;
    endDate?: Date;
    paymentDay: number;
}

export class OccupyUnit {
    constructor(
        private readonly unitRepo: UnitRepository,
        private readonly contractRepo: RentalContractRepository
    ) { }

    async execute(input: OccupyUnitInput): Promise<RentalContract> {
        const unit = await this.unitRepo.findById(input.unitId);

        if (!unit) {
            throw new Error("Unit not found");
        }

        if (unit.getStatus() !== "available") {
            throw new Error("Unit is not available");
        }

        // 1️⃣ Crear contrato
        const contract = new RentalContract(
            crypto.randomUUID(),
            unit.id,
            input.startDate,
            input.endDate ?? null,
            unit.getMonthlyRent(),
            input.paymentDay,
            "active",
            new Date(),
            new Date()
        );

        // 2️⃣ Cambiar estado de la unidad
        const updatedUnit = new Unit(
            unit.id,
            unit.getPropertyID(),
            unit.getCode(),
            unit.getName(),
            unit.getMonthlyRent(),
            "occupied",
            true,
            unit.getCreatedAt(),
            new Date()
        );

        await this.contractRepo.save(contract);
        await this.unitRepo.update(updatedUnit);

        return contract;
    }
}
