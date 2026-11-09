import type { APIRoute } from "astro";
import { handleSignatureStartRequest } from "@/modules/admin/arrendamiento/contratos/firmas/server/request";
import { signatureRequestDependencies } from "@/modules/admin/arrendamiento/contratos/firmas/server/dependencies";

export const prerender = false;
export const ALL: APIRoute = ({ request, params, cookies }) =>
  handleSignatureStartRequest(request, params.contratoId, params.documentoId, signatureRequestDependencies(cookies));
