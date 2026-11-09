import type { AstroCookies } from "astro";
import { supabaseServer } from "@/lib/supabaseServer";
import { requirePdfAdmin } from "../../documentos/server/auth";
import { PdfError } from "../../documentos/server/errors";
import { createServiceRoleClient } from "../../documentos/server/serviceClient";
import { privatePdfStorage } from "../../documentos/server/storage/privateStorage";
import { cancellationRepository, signatureRepository, signatureStarter } from "./repository";
import { createSignatureService } from "./signatureService";
import { createCancellationService } from "./cancellationService";
import type { CancellationRequestDependencies, InvitationRequestDependencies, SignatureRequestDependencies } from "./request";
import { finalPdfRepository, signingRepository } from "./finalPdfRepository";
import { createFinalPdfService } from "./finalPdfService";
import type { FinalPdfReadDependencies, FinalPdfRecoveryDependencies } from "./finalPdfRequest";
import { createInvitationService } from "./invitationService";
import { selectOtpDelivery } from "./otpDelivery";
import { createSignerFlowService } from "./signerFlowService";
import { invitationRepository, signerRepository } from "./signerRepository";
import type { SignerRequestDependencies } from "./signerRequest";
import { createSigningService } from "./signingService";

export function signatureRequestDependencies(cookies: AstroCookies): SignatureRequestDependencies {
  const userClient = supabaseServer(cookies);
  return {
    authorize: () => requirePdfAdmin(userClient),
    service() {
      const admin = createServiceRoleClient();
      return createSignatureService(signatureRepository(admin), privatePdfStorage(admin), signatureStarter(userClient));
    },
  };
}

function finalPdfService() {
  const admin = createServiceRoleClient();
  return createFinalPdfService(finalPdfRepository(admin), privatePdfStorage(admin));
}

// El administrador se autentica con su sesión; el archivo se lee con service_role tras autorizar.
export function finalPdfReadDependencies(cookies: AstroCookies): FinalPdfReadDependencies {
  const userClient = supabaseServer(cookies);
  return { authorize: () => requirePdfAdmin(userClient), service: finalPdfService };
}

export function finalPdfRecoveryDependencies(): FinalPdfRecoveryDependencies {
  return { secret: import.meta.env.CRON_SECRET || process.env.CRON_SECRET, service: finalPdfService };
}

// import.meta.env.DEV se fija al compilar: en una compilación de producción es false, sin importar las variables de entorno.
const otpDelivery = () => selectOtpDelivery({ dev: import.meta.env.DEV, enabled: (import.meta.env.FIRMA_OTP_DEV_CONSOLE || process.env.FIRMA_OTP_DEV_CONSOLE) === "true" });

function otpSecret(): string {
  const secret = import.meta.env.FIRMA_OTP_SECRET || process.env.FIRMA_OTP_SECRET;
  if (!secret || secret.length < 32) throw new PdfError(500, "SERVER_CONFIGURATION", "Falta configurar FIRMA_OTP_SECRET en el servidor.");
  return secret;
}

function siteUrl(): string {
  // De la configuración, nunca de la cabecera Host: el enlace no debe depender de la petición.
  const url = import.meta.env.PUBLIC_SITE_URL || process.env.PUBLIC_SITE_URL;
  if (!url) throw new PdfError(500, "SERVER_CONFIGURATION", "Falta configurar PUBLIC_SITE_URL en el servidor.");
  return url;
}

// El firmante no tiene sesión: se identifica con el token de su invitación, y toda operación pasa por las RPC de 07.
export function signerRequestDependencies(): SignerRequestDependencies {
  return { service() {
    const admin = createServiceRoleClient();
    return createSignerFlowService({ repository: signerRepository(admin), storage: privatePdfStorage(admin), signing: createSigningService(signingRepository(admin), finalPdfService()), otpSecret, otpDelivery });
  } };
}

export function invitationRequestDependencies(cookies: AstroCookies): InvitationRequestDependencies {
  const userClient = supabaseServer(cookies);
  return { authorize: () => requirePdfAdmin(userClient), service: () => createInvitationService(invitationRepository(createServiceRoleClient()), siteUrl) };
}

// Cancelar no necesita service_role: solo la sesión del administrador.
export function cancellationRequestDependencies(cookies: AstroCookies): CancellationRequestDependencies {
  const userClient = supabaseServer(cookies);
  return {
    authorize: () => requirePdfAdmin(userClient),
    service: () => createCancellationService(cancellationRepository(userClient)),
  };
}
