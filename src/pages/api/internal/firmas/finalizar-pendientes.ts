import type { APIRoute } from "astro";
import { handleFinalPdfRecoveryRequest } from "@/modules/admin/arrendamiento/contratos/firmas/server/finalPdfRequest";
import { finalPdfRecoveryDependencies } from "@/modules/admin/arrendamiento/contratos/firmas/server/dependencies";

export const prerender = false;
export const ALL: APIRoute = ({ request }) => handleFinalPdfRecoveryRequest(request, finalPdfRecoveryDependencies());
