import pngjs from "pngjs";
import { PdfError } from "../../documentos/server/errors";

// Límites de la firma dibujada. Los de bytes coinciden con el CHECK de firma_privada.firmas_electronicas.
export const DRAWN_SIGNATURE_LIMITS = {
  minBytes: 67, maxBytes: 262_144,
  minCanvasWidth: 200, minCanvasHeight: 60, maxCanvasPixels: 4_500_000,
  // Un píxel es tinta si, compuesto sobre blanco (el fondo del PDF), queda claramente oscuro.
  inkLuminance: 200,
  minInkPixels: 150, maxInkRatio: 0.35,
  // Extensión mínima del trazo: descarta clics, puntos y rayas rectas.
  minInkWidth: 40, minInkHeight: 10,
  // El trazo continuo mayor: descarta ruido de píxeles sueltos.
  minLargestStroke: 60,
} as const;

export interface DrawnSignatureMetrics {
  width: number; height: number; inkPixels: number; inkRatio: number; inkWidth: number; inkHeight: number; largestStroke: number;
}

const PNG_MAGIC = Buffer.from("89504e470d0a1a0a", "hex");
const invalid = (message: string, cause?: unknown) => new PdfError(422, "DRAWN_SIGNATURE_INVALID", message, cause);
const empty = (message: string) => new PdfError(422, "DRAWN_SIGNATURE_EMPTY", message);

// Lee el PNG completo (también comprueba sus CRC) tras acotar las dimensiones, antes de reservar memoria para los píxeles.
export function decodeSignaturePng(bytes: Uint8Array): { width: number; height: number; data: Buffer } {
  const buffer = Buffer.from(bytes);
  if (buffer.length < DRAWN_SIGNATURE_LIMITS.minBytes || buffer.length > DRAWN_SIGNATURE_LIMITS.maxBytes) throw invalid("La firma debe ser un PNG de hasta 256 KiB.");
  if (!buffer.subarray(0, 8).equals(PNG_MAGIC) || buffer.subarray(12, 16).toString("latin1") !== "IHDR") throw invalid("La firma debe ser una imagen PNG.");
  const width = buffer.readUInt32BE(16), height = buffer.readUInt32BE(20);
  if (width < DRAWN_SIGNATURE_LIMITS.minCanvasWidth || height < DRAWN_SIGNATURE_LIMITS.minCanvasHeight || width * height > DRAWN_SIGNATURE_LIMITS.maxCanvasPixels) {
    throw invalid("Las dimensiones del lienzo de la firma no son válidas.");
  }
  // Un lienzo nunca produce PNG entrelazados, y así no dependemos de cómo los incruste pdf-lib.
  if (buffer[28] !== 0) throw invalid("La firma no puede ser un PNG entrelazado.");
  try {
    const png = pngjs.PNG.sync.read(buffer);
    return { width: png.width, height: png.height, data: png.data };
  } catch (cause) {
    throw invalid("La imagen de la firma está dañada.", cause);
  }
}

function largestComponent(ink: Uint8Array, width: number, height: number): number {
  const seen = new Uint8Array(ink.length);
  const stack: number[] = [];
  let largest = 0;
  for (let start = 0; start < ink.length; start++) {
    if (!ink[start] || seen[start]) continue;
    let size = 0;
    seen[start] = 1; stack.push(start);
    while (stack.length) {
      const index = stack.pop() as number;
      size++;
      const x = index % width, y = (index - x) / width;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const next = ny * width + nx;
        if (ink[next] && !seen[next]) { seen[next] = 1; stack.push(next); }
      }
    }
    if (size > largest) largest = size;
  }
  return largest;
}

// Rechaza lienzos vacíos o sin trazos reales. Mide lo que se verá en el PDF: un trazo blanco o transparente no cuenta.
export function validateDrawnSignature(bytes: Uint8Array): DrawnSignatureMetrics {
  const { width, height, data } = decodeSignaturePng(bytes);
  const limits = DRAWN_SIGNATURE_LIMITS;
  const total = width * height;
  const ink = new Uint8Array(total);
  let inkPixels = 0, minX = width, maxX = -1, minY = height, maxY = -1;
  for (let i = 0; i < total; i++) {
    const offset = i * 4, alpha = data[offset + 3] / 255;
    const luminance = (0.299 * data[offset] + 0.587 * data[offset + 1] + 0.114 * data[offset + 2]) * alpha + 255 * (1 - alpha);
    if (luminance > limits.inkLuminance) continue;
    ink[i] = 1; inkPixels++;
    const x = i % width, y = (i - x) / width;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  if (inkPixels < limits.minInkPixels) throw empty("La firma está vacía: dibuja tu firma antes de confirmar.");
  const inkRatio = inkPixels / total;
  if (inkRatio > limits.maxInkRatio) throw empty("La imagen no parece una firma: el lienzo está casi lleno.");
  const inkWidth = maxX - minX + 1, inkHeight = maxY - minY + 1;
  if (inkWidth < limits.minInkWidth || inkHeight < limits.minInkHeight) throw empty("El trazo es demasiado pequeño para ser una firma.");
  const largestStroke = largestComponent(ink, width, height);
  if (largestStroke < limits.minLargestStroke) throw empty("La imagen no contiene un trazo continuo.");
  return { width, height, inkPixels, inkRatio, inkWidth, inkHeight, largestStroke };
}

export function decodeSignatureBase64(value: unknown): Uint8Array {
  // 4/3 del tamaño máximo más el relleno: no se decodifica nada mayor.
  if (typeof value !== "string" || value.length > 349_528 || value.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) {
    throw invalid("La firma enviada no es válida.");
  }
  return new Uint8Array(Buffer.from(value, "base64"));
}
