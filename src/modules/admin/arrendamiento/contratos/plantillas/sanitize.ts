import DOMPurify from "dompurify";
import { contractSanitizeRules } from "./sanitizeRules";

// Se ejecuta en el navegador, después del renderer puro y antes de asignar srcDoc.
export function sanitizeContractHtml(html: string): string {
  if (!DOMPurify.isSupported) throw new Error("El navegador no permite sanitizar la vista previa de forma segura.");
  return DOMPurify.sanitize(html, { ...contractSanitizeRules(), RETURN_TRUSTED_TYPE: false });
}

export function createPreviewDocument(html: string): string {
  const sanitized = sanitizeContractHtml(html);
  // El CSP es contenido fijo de la aplicación, nunca contenido de la plantilla.
  return `<!doctype html><html lang="es"><head><meta charset="utf-8">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; img-src 'none'; font-src 'none'; connect-src 'none'; base-uri 'none'; form-action 'none'">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>body{margin:0;padding:32px;background:#fff;color:#171717;font-family:Georgia,serif;font-size:16px;line-height:1.6;overflow-wrap:anywhere}table{border-collapse:collapse;max-width:100%}td,th{padding:6px;vertical-align:top}h1,h2,h3{line-height:1.3}pre{white-space:pre-wrap}</style>
    <title>Vista previa del contrato</title></head><body>${sanitized}</body></html>`;
}
