// ui/view-models/UnitCardViewModel.ts
export interface UnitCardViewModel {
    id: string;
    name: string;
    floor: string;
    status: string;
    features: string;
    rent: string;
    tenant?: {
        name: string;
        initials: string;
    };
    expiry?: string;
    paymentStatus?: string;
    vacantDays?: number;
}
