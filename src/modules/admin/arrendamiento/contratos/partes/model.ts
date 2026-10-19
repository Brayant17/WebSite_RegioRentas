export type LandlordType = "PERSONA" | "PERSONA_MORAL";
export interface LandlordSelection { tipo: LandlordType; id: string }
export interface PartyReference { rol: string; persona_id?: string | null; persona_moral_id?: string | null }

// Partes 2B.0 es el comportamiento normal; esquema y RPC validados en producción.
export const contractPartiesEnabled = true;

export function validateLandlord(selection: LandlordSelection | null | undefined): LandlordSelection {
  if (!selection || !["PERSONA", "PERSONA_MORAL"].includes(selection.tipo) || !/^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(selection.id)) {
    throw new Error("Selecciona un arrendador válido y su tipo de persona.");
  }
  return { tipo: selection.tipo, id: selection.id };
}

export function partyEntity(part: PartyReference): LandlordSelection {
  if (Boolean(part.persona_id) === Boolean(part.persona_moral_id)) throw new Error("Cada parte debe tener exactamente una persona física o moral.");
  if (part.persona_moral_id && part.rol !== "ARRENDADOR") throw new Error("Solo ARRENDADOR puede ser persona moral en esta etapa.");
  return { tipo: part.persona_moral_id ? "PERSONA_MORAL" : "PERSONA", id: (part.persona_moral_id || part.persona_id)! };
}

export function resolveLandlord(parts: PartyReference[]): LandlordSelection {
  parts.forEach(partyEntity);
  const landlords = parts.filter(part => part.rol === "ARRENDADOR");
  if (landlords.length !== 1) throw new Error("El contrato debe tener exactamente un ARRENDADOR en sus partes.");
  return partyEntity(landlords[0]);
}
