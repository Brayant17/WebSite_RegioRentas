export type User = {
  id: string;
  full_name: string;
  email: string;
  role: string; // e.g., "admin", "user", etc.
  whatsapp: string;
  approval_status: "approved" | "pending" | "rejected"; // e.g., broker approval status
  created_at: string;
};
