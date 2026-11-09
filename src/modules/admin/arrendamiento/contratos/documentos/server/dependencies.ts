import type { AstroCookies } from "astro";
import { supabaseServer } from "@/lib/supabaseServer";
import { requirePdfAdmin } from "./auth";
import { pdfDocumentRepository } from "./documentRepository";
import { privatePdfStorage } from "./storage/privateStorage";
import { generatePdfFromHtml } from "./pdf/generator";
import { createPdfService } from "./pdfService";
import { createServiceRoleClient } from "./serviceClient";
import type { PdfRequestDependencies } from "./request";

export function pdfRequestDependencies(cookies: AstroCookies): PdfRequestDependencies {
  return {
    authorize: async () => { await requirePdfAdmin(supabaseServer(cookies)); },
    service() {
      const client = createServiceRoleClient();
      return createPdfService(pdfDocumentRepository(client), privatePdfStorage(client), generatePdfFromHtml);
    },
  };
}
