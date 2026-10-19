import { createClient } from "@supabase/supabase-js";
import type { AstroCookies } from "astro";
import { supabaseServer } from "@/lib/supabaseServer";
import { requirePdfAdmin } from "./auth";
import { PdfError } from "./errors";
import { pdfDocumentRepository } from "./documentRepository";
import { privatePdfStorage } from "./storage/privateStorage";
import { generatePdfFromHtml } from "./pdf/generator";
import { createPdfService } from "./pdfService";
import type { PdfRequestDependencies } from "./request";

export function pdfRequestDependencies(cookies: AstroCookies): PdfRequestDependencies {
  return {
    authorize: () => requirePdfAdmin(supabaseServer(cookies)),
    service() {
      if (typeof window !== "undefined") throw new Error("PDF service is server-only");
      const key = import.meta.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
      const url = import.meta.env.PUBLIC_SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL;
      if (!key || !url) throw new PdfError(500, "SERVER_CONFIGURATION", "Falta configurar Supabase en el servidor para generar PDFs.");
      const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
      return createPdfService(pdfDocumentRepository(client), privatePdfStorage(client), generatePdfFromHtml);
    },
  };
}
