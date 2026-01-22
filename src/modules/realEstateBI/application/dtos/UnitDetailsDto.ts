import type { UnitStatus } from "../../domain/entities/Unit";

// application/dtos/UnitDetailsDto.ts
export interface UnitDetailsDto {
    id: string;
    propertyId: string;
    code: string;
    name: string;
    type: string;
    floor: number | null;
    areaM2: number | null;
    bedrooms: number | null;
    bathrooms: number | null;
    parkingSpots: number | null;
    furnished: boolean;
    rentPrice: number;
    currency: string;
    description: string | null;
    status: UnitStatus;
}