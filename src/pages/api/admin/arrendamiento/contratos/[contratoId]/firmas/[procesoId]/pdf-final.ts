import type { APIRoute } from "astro";
import { handleFinalPdfReadRequest } from "@/modules/admin/arrendamiento/contratos/firmas/server/finalPdfRequest";
import { finalPdfReadDependencies } from "@/modules/admin/arrendamiento/contratos/firmas/server/dependencies";

export const prerender = false;
export const ALL: APIRoute = ({ request, params, cookies }) =>
  handleFinalPdfReadRequest(request, params.contratoId, params.procesoId, finalPdfReadDependencies(cookies));
