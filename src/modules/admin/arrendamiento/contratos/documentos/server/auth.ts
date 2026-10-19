import type { SupabaseClient } from "@supabase/supabase-js";
import { PdfError } from "./errors";

export async function requirePdfAdmin(client: SupabaseClient): Promise<void> {
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw new PdfError(401, "UNAUTHENTICATED", "Inicia sesión para acceder a los PDFs del contrato.");
  const { data: account, error: roleError } = await client.from("users").select("role").eq("id", data.user.id).maybeSingle<{ role: string }>();
  if (roleError || account?.role !== "admin") throw new PdfError(403, "FORBIDDEN", "Tu cuenta no tiene permisos de administrador para esta operación.", roleError);
}
