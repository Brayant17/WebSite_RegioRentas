import type { SupabaseClient } from "@supabase/supabase-js";
import type { PdfStorage } from "../types";
import { PdfError } from "../errors";

export const PDF_BUCKET = "contract-documents";

function storageStatus(error: unknown): string {
  if (typeof error !== "object" || error === null) return "";
  if ("statusCode" in error) return String(error.statusCode);
  if ("status" in error) return String(error.status);
  return "";
}
function storageCode(error: unknown): string {
  return typeof error === "object" && error !== null && "code" in error ? String(error.code) : "";
}

export function privatePdfStorage(client: SupabaseClient): PdfStorage {
  const bucket = client.storage.from(PDF_BUCKET);
  return {
    async assertPrivateBucket() {
      const { data, error } = await client.storage.getBucket(PDF_BUCKET);
      if (error || !data) throw new PdfError(500, "BUCKET_UNAVAILABLE", "No se puede acceder al bucket privado contract-documents. Comprueba que exista y la configuración de Supabase del servidor.", error);
      if (data.public !== false) throw new PdfError(500, "BUCKET_NOT_PRIVATE", "El bucket contract-documents debe ser privado. Se bloqueó el acceso hasta corregir su configuración.");
    },
    async hasPdf(path) {
      const { data, error } = await bucket.info(path);
      if (error) {
        if (storageStatus(error) === "404" || ["NoSuchKey", "not_found"].includes(storageCode(error))) return false;
        throw new PdfError(500, "STORAGE_LOOKUP_FAILED", "No se pudo comprobar el archivo PDF en Storage. No se generará un reemplazo sin verificar su estado.", error);
      }
      if (!data || data.contentType !== "application/pdf" || !((data.size ?? 0) > 0)) {
        throw new PdfError(409, "INVALID_STORED_OBJECT", "La ruta reservada contiene un objeto que no es un PDF válido. Requiere revisión; no se sobrescribirá.");
      }
      return true;
    },
    async upload(path, bytes) {
      const { error } = await bucket.upload(path, bytes, { contentType: "application/pdf", upsert: false, cacheControl: "0" });
      if (!error) return;
      if (storageStatus(error) === "409" || ["Duplicate", "ResourceAlreadyExists", "KeyAlreadyExists"].includes(storageCode(error)) || /already exists/i.test(error.message)) {
        throw new PdfError(409, "OBJECT_EXISTS", "Otra petición ya guardó el PDF en esta ruta.", error);
      }
      throw new PdfError(500, "UPLOAD_FAILED", "No se pudo subir el PDF al bucket privado. El documento no se marcó como disponible; puedes reintentar.", error);
    },
    async signedUrl(path, downloadName) {
      const { data, error } = await bucket.createSignedUrl(path, 300, downloadName ? { download: downloadName } : undefined);
      if (error || !data?.signedUrl) throw new PdfError(500, "SIGNED_URL_FAILED", "No se pudo crear el acceso temporal al PDF. Vuelve a intentarlo.", error);
      return data.signedUrl;
    },
    async download(path) {
      const { data, error } = await bucket.download(path);
      if (error || !data) throw new PdfError(500, "DOWNLOAD_FAILED", "No se pudo descargar el PDF del bucket privado para verificarlo. Vuelve a intentarlo.", error);
      return new Uint8Array(await data.arrayBuffer());
    },
  };
}
