import type { APIRoute } from "astro";
import { handlePdfRequest } from "@/modules/admin/arrendamiento/contratos/documentos/server/request";
import { pdfRequestDependencies } from "@/modules/admin/arrendamiento/contratos/documentos/server/dependencies";

export const prerender = false;
export const ALL: APIRoute = ({ request, params, cookies }) =>
  handlePdfRequest(request, params.contratoId, params.documentoId, "access", pdfRequestDependencies(cookies));
