import type { SignatureInvitationState } from "../types";

const contractApi = (contractId: string) => `/api/admin/arrendamiento/contratos/${encodeURIComponent(contractId)}`;

async function post<T>(url: string, body: object | undefined, fallback: string): Promise<T> {
  const response = await fetch(url, {
    method: "POST", credentials: "same-origin",
    ...(body ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error?.message || fallback);
  if (!data) throw new Error("El servidor devolvió una respuesta de firma no válida.");
  return data;
}

// Sin cuerpo: hashes, fuentes e identidades se calculan en el servidor, nunca en el navegador.
export async function startSignatureProcess(contractId: string, documentId: string): Promise<{ procesoId: string }> {
  const data = await post<{ procesoId?: string }>(`${contractApi(contractId)}/documentos/${encodeURIComponent(documentId)}/firma`, undefined, "No se pudo iniciar la firma. Vuelve a intentarlo.");
  if (!data.procesoId) throw new Error("El servidor devolvió una respuesta de firma no válida.");
  return { procesoId: data.procesoId };
}

// El enlace solo existe en esta respuesta: el servidor guarda el hash del token y no puede volver a mostrarlo.
export function createSignatureInvitation(contractId: string, processId: string, signerId: string): Promise<{ enlace: string; expiraAt: string }> {
  return post(`${contractApi(contractId)}/firmas/${encodeURIComponent(processId)}/invitaciones`, { firmanteId: signerId }, "No se pudo generar el enlace. Vuelve a intentarlo.");
}

export async function listSignatureInvitations(contractId: string, processId: string): Promise<SignatureInvitationState[]> {
  const response = await fetch(`${contractApi(contractId)}/firmas/${encodeURIComponent(processId)}/invitaciones`, { credentials: "same-origin" });
  const data = await response.json().catch(() => null);
  if (!response.ok || !Array.isArray(data?.invitaciones)) throw new Error(data?.error?.message || "No se pudo consultar el estado de las invitaciones.");
  return data.invitaciones;
}

export function cancelSignatureProcess(contractId: string, processId: string, motivo: string): Promise<{ procesoId: string; estado: "CANCELADO" }> {
  return post(`${contractApi(contractId)}/firmas/${encodeURIComponent(processId)}/cancelar`, { motivo }, "No se pudo cancelar el proceso de firma. Vuelve a intentarlo.");
}
