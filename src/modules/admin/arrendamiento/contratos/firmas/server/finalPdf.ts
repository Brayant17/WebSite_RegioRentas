import { PDFDocument, PDFName, PDFRawStream, PDFRef, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { createHash } from "node:crypto";
import { PdfError } from "../../documentos/server/errors";
import { signerCharacterLabel, signerRoleLabel } from "../signerLabels";
import { decodeSignaturePng } from "./drawnSignature";

// Forma de datos_pdf_final_firma (07).
export interface FinalPdfManifestEntry {
  firma_id: string; firmante_id: string; rol: string; caracter: string; nombre_entidad: string; persona_firmante_id: string;
  nombre_firmante: string; firmado_at: string; sha256_documento: string; sha256_firma: string; sha256_evidencia: string;
}
export interface FinalPdfData {
  proceso_id: string; contrato_id: string; documento_id: string; storage_path_origen: string; sha256_documento_origen: string; ruta_pdf_final: string;
  manifiesto: FinalPdfManifestEntry[]; sha256_manifiesto: string;
  imagenes: { firma_id: string; mime_type: string; imagen_base64: string; sha256_firma: string }[];
}

export const FINAL_PDF_GENERATOR = "firmas-2c-pdf-lib-v1";
export const FINAL_PDF_MANIFEST_NAME = "manifiesto-firmas.json";
export const MAX_FINAL_PDF_BYTES = 10_485_760;

const PAGE = { width: 612, height: 792, margin: 54 } as const;
const BLOCK_HEIGHT = 148;
const SIGNATURE_BOX = { width: 170, height: 72 } as const;
const INK = rgb(0.1, 0.1, 0.1), MUTED = rgb(0.4, 0.4, 0.4);

export const sha256Hex = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const keywordsOf = (data: Pick<FinalPdfData, "sha256_manifiesto" | "sha256_documento_origen">) =>
  [`firma2c_sha256_manifiesto=${data.sha256_manifiesto}`, `firma2c_sha256_origen=${data.sha256_documento_origen}`];

// Helvetica solo codifica WinAnsi. Un nombre con otros caracteres no debe impedir el cierre: se translitera lo posible,
// y el nombre exacto sigue en el manifiesto adjunto.
function printable(font: PDFFont, text: string): string {
  return Array.from(text.replace(/\s+/g, " ").trim()).map(char => {
    for (const candidate of [char, char.normalize("NFD").replace(/\p{M}/gu, "")]) {
      if (!candidate) continue;
      try { font.encodeText(candidate); return candidate; } catch { /* siguiente candidato */ }
    }
    return "?";
  }).join("");
}

function wrapped(font: PDFFont, text: string, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  let current = "";
  for (const word of printable(font, text).split(" ")) {
    const next = current ? `${current} ${word}` : word;
    if (current && font.widthOfTextAtSize(next, size) > maxWidth) { lines.push(current); current = word; } else current = next;
  }
  if (current) lines.push(current);
  return lines;
}

function signaturePngs(data: FinalPdfData): Map<string, Uint8Array> {
  const pngs = new Map<string, Uint8Array>();
  for (const entry of data.manifiesto) {
    const image = data.imagenes.find(item => item.firma_id === entry.firma_id);
    if (!image) throw new PdfError(409, "FINAL_PDF_SIGNATURE_MISSING", "Falta la imagen de una firma del manifiesto.");
    const png = new Uint8Array(Buffer.from(image.imagen_base64, "base64"));
    if (sha256Hex(png) !== entry.sha256_firma) throw new PdfError(409, "FINAL_PDF_SIGNATURE_MISMATCH", "La imagen de una firma no coincide con su hash registrado.");
    decodeSignaturePng(png);
    pngs.set(entry.firma_id, png);
  }
  return pngs;
}

// Añade al PDF original una constancia con las firmas gráficas y su evidencia, y adjunta el manifiesto. Las páginas
// originales se conservan. pdf-lib reescribe el archivo, por eso el resultado tiene su propio SHA-256.
export async function buildFinalSignedPdf(input: { original: Uint8Array; data: FinalPdfData; folio: string | null }): Promise<Uint8Array> {
  const { data } = input;
  if (!data.manifiesto.length) throw new PdfError(409, "FINAL_PDF_SIGNATURE_MISSING", "El manifiesto no contiene firmas.");
  const pngs = signaturePngs(data);
  let doc: PDFDocument;
  try { doc = await PDFDocument.load(input.original, { updateMetadata: false }); }
  catch (cause) { throw new PdfError(409, "FINAL_PDF_ORIGIN_UNREADABLE", "No se pudo leer el PDF original.", cause); }
  const originalPages = doc.getPageCount();
  const regular = await doc.embedFont(StandardFonts.Helvetica), bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const contentWidth = PAGE.width - PAGE.margin * 2;
  let page: PDFPage = doc.addPage([PAGE.width, PAGE.height]);
  let cursor = 0, sheet = 0;

  const line = (text: string, options: { size?: number; font?: PDFFont; color?: ReturnType<typeof rgb>; x?: number; maxWidth?: number } = {}) => {
    const { size = 9, font = regular, color = INK, x = PAGE.margin, maxWidth = contentWidth } = options;
    for (const part of wrapped(font, text, size, maxWidth)) {
      page.drawText(part, { x, y: cursor, size, font, color });
      cursor -= size + 3;
    }
  };
  const startSheet = () => {
    if (sheet > 0) page = doc.addPage([PAGE.width, PAGE.height]);
    sheet++;
    cursor = PAGE.height - PAGE.margin;
    line("Constancia de firmas electrónicas", { size: 15, font: bold });
    cursor -= 4;
    if (sheet === 1) {
      line(`Contrato: ${input.folio ?? data.contrato_id}`);
      line(`Proceso de firma: ${data.proceso_id}`);
      line(`Páginas del documento original: ${originalPages}`);
      line(`SHA-256 del documento original: ${data.sha256_documento_origen}`, { size: 8 });
      line(`SHA-256 del manifiesto de firmas: ${data.sha256_manifiesto}`, { size: 8 });
      cursor -= 2;
      line("Registro técnico de las firmas electrónicas recabadas sobre el documento identificado. El detalle de la evidencia se conserva en el sistema y el manifiesto va adjunto a este archivo. Esta constancia no es un dictamen sobre la validez jurídica de las firmas.", { size: 8, color: MUTED });
    } else {
      line(`SHA-256 del manifiesto de firmas: ${data.sha256_manifiesto}`, { size: 8, color: MUTED });
    }
    cursor -= 12;
  };

  startSheet();
  for (const entry of data.manifiesto) {
    if (cursor - BLOCK_HEIGHT < PAGE.margin) startSheet();
    const top = cursor;
    page.drawLine({ start: { x: PAGE.margin, y: top + 8 }, end: { x: PAGE.width - PAGE.margin, y: top + 8 }, thickness: 0.5, color: MUTED });
    const textX = PAGE.margin + SIGNATURE_BOX.width + 14, textWidth = contentWidth - SIGNATURE_BOX.width - 14;
    cursor = top - 8;
    line(`${signerRoleLabel(entry.rol)}: ${entry.nombre_firmante}`, { size: 10, font: bold, x: textX, maxWidth: textWidth });
    if (entry.nombre_entidad && entry.nombre_entidad !== entry.nombre_firmante) line(`En representación de ${entry.nombre_entidad}`, { x: textX, maxWidth: textWidth });
    const character = signerCharacterLabel(entry.caracter);
    if (character) line(`Carácter: ${character}`, { x: textX, maxWidth: textWidth });
    line(`Firmado (UTC): ${entry.firmado_at}`, { x: textX, maxWidth: textWidth });
    const image = await doc.embedPng(pngs.get(entry.firma_id) as Uint8Array);
    const scale = Math.min(SIGNATURE_BOX.width / image.width, SIGNATURE_BOX.height / image.height);
    page.drawImage(image, { x: PAGE.margin, y: top - SIGNATURE_BOX.height - 2, width: image.width * scale, height: image.height * scale });
    cursor = top - SIGNATURE_BOX.height - 14;
    line(`SHA-256 de la firma: ${entry.sha256_firma}`, { size: 7, color: MUTED });
    line(`SHA-256 de la evidencia: ${entry.sha256_evidencia}`, { size: 7, color: MUTED });
    cursor = top - BLOCK_HEIGHT;
  }

  // Fechas fijas, derivadas de las firmas: no dependen del momento en que se genera el archivo.
  const signedAt = new Date(data.manifiesto.map(entry => entry.firmado_at).sort().at(-1) as string);
  await doc.attach(new TextEncoder().encode(JSON.stringify({ sha256_documento_origen: data.sha256_documento_origen, sha256_manifiesto: data.sha256_manifiesto, firmas: data.manifiesto })),
    FINAL_PDF_MANIFEST_NAME, { mimeType: "application/json", description: "Manifiesto de firmas", creationDate: signedAt, modificationDate: signedAt });
  doc.setKeywords(keywordsOf(data));
  doc.setModificationDate(signedAt);
  return doc.save({ useObjectStreams: true });
}

function embeddedImageCount(doc: PDFDocument): number {
  const masks = new Set<string>(), images: string[] = [];
  for (const [ref, object] of doc.context.enumerateIndirectObjects()) {
    if (!(object instanceof PDFRawStream) || object.dict.get(PDFName.of("Subtype")) !== PDFName.of("Image")) continue;
    images.push(ref.toString());
    const mask = object.dict.get(PDFName.of("SMask"));
    if (mask instanceof PDFRef) masks.add(mask.toString());
  }
  return images.filter(ref => !masks.has(ref)).length;
}

// Un PDF ya presente en la ruta final (intento anterior o petición simultánea) solo se acepta si es de este proceso.
export async function assertFinalPdfMatches(bytes: Uint8Array, data: FinalPdfData): Promise<void> {
  let doc: PDFDocument;
  try { doc = await PDFDocument.load(bytes, { updateMetadata: false }); }
  catch (cause) { throw new PdfError(409, "FINAL_PDF_CONFLICT", "La ruta del PDF final contiene un archivo ilegible. Requiere revisión; no se sobrescribirá.", cause); }
  const keywords = doc.getKeywords() ?? "";
  if (!keywordsOf(data).every(keyword => keywords.includes(keyword)) || embeddedImageCount(doc) < data.manifiesto.length) {
    throw new PdfError(409, "FINAL_PDF_CONFLICT", "La ruta del PDF final contiene un archivo de otro proceso o sin las firmas vigentes. Requiere revisión; no se sobrescribirá.");
  }
}
