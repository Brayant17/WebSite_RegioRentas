// application/dto/CreatePropertyInput.ts (o presentation/types)
export interface CreatePropertyInput {
    name: string;
    address: string;
    city?: string | undefined;
    state?: string;
    postalCode?: string;
    active?: boolean;
}
