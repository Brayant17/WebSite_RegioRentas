import type { APIRoute } from "astro";
import { handleSignatureCancelRequest } from "@/modules/admin/arrendamiento/contratos/firmas/server/request";
import { cancellationRequestDependencies } from "@/modules/admin/arrendamiento/contratos/firmas/server/dependencies";

export const prerender = false;
export const ALL: APIRoute = ({ request, params, cookies }) =>
  handleSignatureCancelRequest(request, params.contratoId, params.procesoId, cancellationRequestDependencies(cookies));
