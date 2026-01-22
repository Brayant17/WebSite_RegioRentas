// application/dtos/CreateUnitInput.ts
import type { UnitType } from "../../domain/entities/Unit";

export interface CreateUnitInput {
    propertyId: string;
    code: string;
    name: string;
    type: UnitType;
    floor?: number | null;
    areaM2?: number | null;
    bedrooms?: number | null;
    bathrooms?: number | null;
    parkingSpots?: number | null;
    rentPrice: number;
    currency: string;
    furnished: boolean;
    description?: string | null;
}
