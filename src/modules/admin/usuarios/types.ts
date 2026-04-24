export type User = {
  id: string;
  full_name: string;
  email: string;
  whatsapp: string;
  avatar_url?: string;
  role: "admin" | "user" | "collaborator"; // e.g., "admin", "user", etc.
  account_type: "basic" | "premium"; // e.g., account type
  user_status: boolean; // active or inactives
  is_verified: boolean;
  created_at: string;
};

export type UserFilters = {
  email?: string;
  role?: string;
  account_type?: string;
  is_verified?: string;
};

export type RequestPremium = {
  id: string,
  user_id: string,
  user_email: string,
  user_name: string,
  status: string,
  requested_type: string,
  created_at: string,
}