import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { PdfError } from "./errors";

// Solo servidor: la clave service_role nunca llega al navegador. Construir tras autorizar.
export function createServiceRoleClient(): SupabaseClient {
  if (typeof window !== "undefined") throw new Error("Service role client is server-only");
  const key = import.meta.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = import.meta.env.PUBLIC_SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL;
  if (!key || !url) throw new PdfError(500, "SERVER_CONFIGURATION", "Falta configurar Supabase en el servidor para esta operación.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}
