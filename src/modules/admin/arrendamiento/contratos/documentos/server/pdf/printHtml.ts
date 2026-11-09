import createDOMPurify from "dompurify";
import { JSDOM } from "jsdom";
import { contractSanitizeRules } from "../../../plantillas/sanitizeRules";
import { PdfError } from "../errors";
import { printCss } from "./layout";
import { decoratePrintDocument } from "./presentation";

export function printHtml(html: string): string {
  const dom = new JSDOM("");
  try {
    const clean = createDOMPurify(dom.window).sanitize(html, { ...contractSanitizeRules(), RETURN_TRUSTED_TYPE: false });
    dom.window.document.body.innerHTML = clean;
    if (!dom.window.document.body.textContent?.trim()) throw new PdfError(422, "EMPTY_HTML", "El documento no contiene texto contractual válido.");
    decoratePrintDocument(dom.window.document);
    return `<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'none'; base-uri 'none'; form-action 'none'">
<style>${printCss}</style></head><body>${dom.window.document.body.innerHTML}</body></html>`;
  } finally { dom.window.close(); }
}
