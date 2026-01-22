import type { UnitCardDto } from "../../application/dtos/UnitCardDto";
import type { UnitDetailsDto } from "../../application/dtos/UnitDetailsDto";
import { Unit } from "../entities/Unit";

export type UnitFilter = "ALL" | "AVAILABLE" | "OCCUPIED" | "DELINQUENT";

export interface UnitRepository {
    save(unit: Unit): Promise<void>;
    findById(id: string): Promise<Unit | null>;
    update(unit: Unit): Promise<void>;

    // lectura para UI
    findByProperty(propertyId: string): Promise<UnitDetailsDto[]>;
    getUnitCards(propertyId:string, filter: UnitFilter): Promise<UnitCardDto[]>
}
