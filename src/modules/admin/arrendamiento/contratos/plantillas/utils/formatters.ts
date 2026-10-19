import { representativeCharacters } from "@/modules/admin/configuracion/arrendador/types";

export function templateText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value !== "string" && typeof value !== "number") return "";
  const text = String(value).trim().replace(/\s+/g, " ");
  return /^(null|undefined)$/i.test(text) ? "" : text;
}

export function fullName(person: { nombre?: string | null; apellido_paterno?: string | null; apellido_materno?: string | null } | null | undefined): string {
  return [person?.nombre, person?.apellido_paterno, person?.apellido_materno].map(templateText).filter(Boolean).join(" ");
}

const months = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
function dateParts(value: string | null | undefined) {
  const text = templateText(value);
  if (!text) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) throw new Error(`Fecha de contrato inválida: ${text}.`);
  const [year, month, day] = text.split("-").map(Number);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > days[month - 1]) throw new Error(`Fecha de contrato inválida: ${text}.`);
  return { year: text.slice(0, 4), month, day };
}

export function formatDate(value: string | null | undefined): string {
  const date = dateParts(value);
  return date ? `${String(date.day).padStart(2, "0")}/${String(date.month).padStart(2, "0")}/${date.year}` : "";
}

export function dateInWords(value: string | null | undefined): string {
  const date = dateParts(value);
  return date ? `${date.day} de ${months[date.month - 1]} de ${date.year}` : "";
}

// numeric(12,2): separar dígitos mantiene centavos exactos, sin redondear floats.
function moneyParts(value: string | number | null | undefined) {
  const text = templateText(value);
  if (!text) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(text)) throw new Error("El importe del contrato debe ser un decimal no negativo con hasta dos decimales.");
  const [whole, fraction = ""] = text.split(".");
  const pesos = Number(whole);
  if (!Number.isSafeInteger(pesos) || pesos > 9999999999) throw new Error("El importe del contrato excede el rango numeric(12,2).");
  return { pesos, cents: fraction.padEnd(2, "0") };
}

export function formatMoney(value: string | number | null | undefined): string {
  const parts = moneyParts(value);
  return parts ? `$${String(parts.pesos).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${parts.cents}` : "";
}

const small = ["CERO", "UNO", "DOS", "TRES", "CUATRO", "CINCO", "SEIS", "SIETE", "OCHO", "NUEVE", "DIEZ", "ONCE", "DOCE", "TRECE", "CATORCE", "QUINCE", "DIECISÉIS", "DIECISIETE", "DIECIOCHO", "DIECINUEVE", "VEINTE", "VEINTIUNO", "VEINTIDÓS", "VEINTITRÉS", "VEINTICUATRO", "VEINTICINCO", "VEINTISÉIS", "VEINTISIETE", "VEINTIOCHO", "VEINTINUEVE"];
const tens = ["", "", "", "TREINTA", "CUARENTA", "CINCUENTA", "SESENTA", "SETENTA", "OCHENTA", "NOVENTA"];
const hundreds = ["", "CIENTO", "DOSCIENTOS", "TRESCIENTOS", "CUATROCIENTOS", "QUINIENTOS", "SEISCIENTOS", "SETECIENTOS", "OCHOCIENTOS", "NOVECIENTOS"];
function apocopate(text: string): string {
  return text.replace(/VEINTIUNO$/, "VEINTIÚN").replace(/UNO$/, "UN");
}
function integerWords(value: number): string {
  if (value < 30) return small[value];
  if (value < 100) return `${tens[Math.floor(value / 10)]}${value % 10 ? ` Y ${small[value % 10]}` : ""}`;
  if (value === 100) return "CIEN";
  if (value < 1000) return `${hundreds[Math.floor(value / 100)]}${value % 100 ? ` ${integerWords(value % 100)}` : ""}`;
  if (value < 1000000) return `${value < 2000 ? "MIL" : `${apocopate(integerWords(Math.floor(value / 1000)))} MIL`}${value % 1000 ? ` ${integerWords(value % 1000)}` : ""}`;
  const millions = Math.floor(value / 1000000);
  return `${millions === 1 ? "UN MILLÓN" : `${apocopate(integerWords(millions))} MILLONES`}${value % 1000000 ? ` ${integerWords(value % 1000000)}` : ""}`;
}

export function moneyInWords(value: string | number | null | undefined): string {
  const parts = moneyParts(value);
  if (!parts) return "";
  const noun = parts.pesos === 1 ? "PESO" : parts.pesos > 0 && parts.pesos % 1000000 === 0 ? "DE PESOS" : "PESOS";
  return `${apocopate(integerWords(parts.pesos))} ${noun} ${parts.cents}/100 M.N.`;
}

export function representativeCharacter(value: string | null | undefined): string {
  const text = templateText(value);
  if (!text) return "";
  if (!Object.hasOwn(representativeCharacters, text)) throw new Error(`Carácter del representante no reconocido: ${text}.`);
  return representativeCharacters[text as keyof typeof representativeCharacters];
}

export function fullAddress(building: { direccion?: string | null; ciudad?: string | null; estado?: string | null; codigo_postal?: string | null } | null | undefined): string {
  return [building?.direccion, building?.ciudad, building?.estado, building?.codigo_postal]
    .map(value => templateText(value).replace(/^,+|,+$/g, "").replace(/\s*,\s*(?:,\s*)*/g, ", ").trim())
    .filter(Boolean).join(", ");
}
