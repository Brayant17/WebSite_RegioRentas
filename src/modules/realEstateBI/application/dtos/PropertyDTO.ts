// application/dtos/PropertyDTO.ts
export interface PropertyDTO {
    id: string;
    name: string;
    address: string;
    city?: string;
    state?: string;
    postalCode?: string;
    active?: boolean;
}
