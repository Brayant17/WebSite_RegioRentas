// application/dto/CreatePropertyInput.ts (o presentation/types)
export interface CreatePropertyInput {
    name: string;
    address: string;
    city?: string;
    state?: string;
    postalCode?: string;
    active?: boolean;
}
