import type { PaymentStatus } from "../../types/unit.type";

export interface TenantDTO {
    id: string;
    name: string;
    avatarUrl?: string;

    initials: string;
    initialsBg: string;
    initialsText: string;
}

interface BaseUnitDTO {
    id: string;
    name: string;
    floor: string;
    location: string;

    bedrooms: number;
    area: number;
}

export interface OccupiedUnitDTO extends BaseUnitDTO {
    status: "Ocupado";

    tenant: TenantDTO;

    contractEnds: string;
    rent: number;
    payment: PaymentStatus;
}

export interface AvailableUnitDTO extends BaseUnitDTO {
    status: "Disponible";

    tenant: null;

    suggestedRent: number;
    vacantSince: string;
}

export type UnitDTO = OccupiedUnitDTO | AvailableUnitDTO;
