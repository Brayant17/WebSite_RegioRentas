export interface UnitCardDto {
    id: string;
    code: string;
    name: string;
    floor: string | null;
    status: "Disponible" | "Ocupado" | "Moroso" | "Mantenimiento";
    features: string;
    rent: string | null;
    tenant?: {
        name: string;
    };
    expiry?: string;
}
