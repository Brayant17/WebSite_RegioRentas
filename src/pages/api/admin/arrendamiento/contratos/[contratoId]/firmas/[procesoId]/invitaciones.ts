import type { APIRoute } from "astro";
import { handleSignatureInvitationListRequest, handleSignatureInvitationRequest } from "@/modules/admin/arrendamiento/contratos/firmas/server/request";
import { invitationRequestDependencies } from "@/modules/admin/arrendamiento/contratos/firmas/server/dependencies";

export const prerender = false;
export const GET: APIRoute = ({ request, params, cookies }) =>
  handleSignatureInvitationListRequest(request, params.contratoId, params.procesoId, invitationRequestDependencies(cookies));
export const ALL: APIRoute = ({ request, params, cookies }) =>
  handleSignatureInvitationRequest(request, params.contratoId, params.procesoId, invitationRequestDependencies(cookies));
