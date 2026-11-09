import { representativeCharacters } from "@/modules/admin/configuracion/arrendador/types";

// Etiquetas únicas para la constancia del PDF final y la página del firmante. No aplican al consentimiento, que genera 07.
const ROLE_LABELS: Record<string, string> = {
  ARRENDADOR: "Arrendador", ARRENDATARIO: "Arrendatario", FIADOR: "Fiador", OBLIGADO_SOLIDARIO: "Obligado solidario", REPRESENTANTE_LEGAL: "Representante legal",
};

export const signerRoleLabel = (role: string): string => ROLE_LABELS[role] ?? "Firmante";

// null significa que no se muestra carácter: OTRO no acredita ninguno, y un valor con forma de código no tiene una lectura
// segura. El texto libre fuera del catálogo se muestra sin cambios, como en 07.
export function signerCharacterLabel(character: string): string | null {
  if (character === "OTRO") return null;
  if (character === "POR_DERECHO_PROPIO") return "Por derecho propio";
  if (Object.hasOwn(representativeCharacters, character)) return representativeCharacters[character as keyof typeof representativeCharacters];
  return /^[a-z0-9]+(_[a-z0-9]+)+$/i.test(character) ? null : character;
}
