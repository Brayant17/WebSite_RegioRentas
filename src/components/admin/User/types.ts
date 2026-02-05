export type User = {
  id: string;
  full_name: string;
  email: string;
  whatsapp: string;
  avatar_url?: string;
  role: "admin" | "user" | "collaborator"; // e.g., "admin", "user", etc.
  account_type: "basic" | "premium"; // e.g., account type
  user_status: boolean;
  is_verified: boolean;
  created_at: string;
};
