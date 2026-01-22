import { RentalContract } from "../entities/RentalContract";

export interface RentalContractRepository {
    save(contract: RentalContract): Promise<void>;
    findActiveByUnitId(unitId: string): Promise<RentalContract | null>;
}
