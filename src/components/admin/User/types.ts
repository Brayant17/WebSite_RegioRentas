export type User = {
  id: string;
  email: string;
  role: string;
  whatsapp: string;
  approval_status: "approved" | "pending" | "rejected";
  created_at: string;
};
