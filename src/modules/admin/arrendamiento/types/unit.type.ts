export type PaymentStatus = "al_dia" | "pendiente";

export interface Tenant {
    id: string;
    name: string;
    avatarUrl?: string;
}

interface BaseUnit {
    id: string;
    name: string;
    floor: string;
    location: string;
    bedrooms: number;
    area: number;
}

export interface OccupiedUnit extends BaseUnit {
    status: "Ocupado";

    tenant: Tenant;
    contractEnds: string;
    rent: number;
    payment: PaymentStatus;
}

export interface AvailableUnit extends BaseUnit {
    status: "Disponible";

    tenant: null;
    suggestedRent: number;
    vacantSince: string;
}

export type Unit = OccupiedUnit | AvailableUnit;
