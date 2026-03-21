export type UserProfile = {
    full_name: string;
    email: string;
    avatar_url: string;
    account_type: "basic" | "premium" | null;
    is_verified: boolean;
    whatsapp: string;
    brokerRequestStatus: "none" | "pending" | "approved" | "rejected";
};
