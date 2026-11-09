// Vista previa para el administrador antes de iniciar la firma. Solo orienta: el texto real lo genera
// firma_privada.calidad_firmante (07), y una prueba compara ambas contra la función de SQL.
const ROLE_PHRASES: Record<string, string> = {
  ARRENDADOR: "parte arrendadora", ARRENDATARIO: "parte arrendataria", FIADOR: "parte fiadora",
  OBLIGADO_SOLIDARIO: "parte obligada solidaria", REPRESENTANTE_LEGAL: "representante legal",
};

// Misma normalización con la que 02 congela el carácter (firma_privada.texto).
function frozenText(value: string | null | undefined): string {
  const text = (value ?? "").trim().replace(/\s+/g, " ");
  return /^(null|undefined)$/i.test(text) ? "" : text;
}

export function representationQuality(character: string | null | undefined, company: string, role: string): string {
  const text = frozenText(character);
  const representation = text === "REPRESENTANTE_LEGAL" ? `en mi carácter de representante legal de ${company}`
    : text === "APODERADO_LEGAL" ? `en mi carácter de apoderado legal de ${company}`
    : text === "ADMINISTRADOR" ? `en mi carácter de administrador de ${company}`
    : text === "OTRO" || /^[a-z0-9]+(_[a-z0-9]+)+$/i.test(text) ? `en representación de ${company}`
    : `en representación de ${company}, con el carácter registrado de «${text}»`;
  return `${representation}, como ${ROLE_PHRASES[role]}`;
}

export type RepresentationStatus = "ok" | "warning" | "blocking";
export interface RepresentationReview { status: RepresentationStatus; message: string; quality: string | null }

// Nunca corrige ni traduce nada: indica qué verá el firmante y qué conviene revisar. Lo que bloquea es lo que el servidor rechazaría.
export function reviewRepresentation(input: { company: string; role: string; representatives: { caracter: string | null }[]; catalog: Record<string, string> }): RepresentationReview {
  if (input.representatives.length !== 1) return { status: "blocking", quality: null, message: "La persona moral debe tener exactamente un representante principal." };
  const character = frozenText(input.representatives[0].caracter);
  if (!character) return { status: "blocking", quality: null, message: "El representante principal no tiene un carácter registrado." };
  if (!Object.hasOwn(input.catalog, character)) return { status: "blocking", quality: null, message: `El carácter registrado («${character}») no está en el catálogo. Selecciona una opción válida.` };
  const quality = representationQuality(character, input.company, input.role);
  if (quality.startsWith("en mi carácter de ")) return { status: "ok", quality, message: "" };
  if (!quality.includes("«")) return { status: "warning", quality, message: "El consentimiento no indicará un carácter específico: solo dirá que actúa en representación de la persona moral." };
  return { status: "warning", quality, message: `El consentimiento mostrará el valor registrado tal como está («${character}»).` };
}
