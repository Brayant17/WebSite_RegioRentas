import type { APIRoute } from "astro";
import { handleSignerConsentRequest } from "@/modules/admin/arrendamiento/contratos/firmas/server/signerRequest";
import { signerRequestDependencies } from "@/modules/admin/arrendamiento/contratos/firmas/server/dependencies";

export const prerender = false;
export const ALL: APIRoute = ({ request }) => handleSignerConsentRequest(request, signerRequestDependencies());
