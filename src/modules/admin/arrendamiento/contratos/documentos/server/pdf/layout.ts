import type { Page } from "playwright-core";

export const printMargins = { top: "20mm", right: "20mm", bottom: "22mm", left: "20mm" };

export const printCss = `
@page{size:Letter;margin:${printMargins.top} ${printMargins.right} ${printMargins.bottom} ${printMargins.left}}
html{color:#111;background:#fff}
body{margin:0;font-family:Arial,Helvetica,sans-serif;font-size:11pt;line-height:1.45;overflow-wrap:break-word}
p{margin:0 0 6pt;text-align:justify;hyphens:auto;orphans:3;widows:3}
h1,h2,h3,h4,h5,h6,.pdf-section,.pdf-clause-title{break-after:avoid;page-break-after:avoid;break-inside:avoid;page-break-inside:avoid}
h1,.pdf-title{font-size:15pt!important;font-weight:700!important;text-align:center!important;line-height:1.25;margin:0 0 16pt!important;break-after:avoid;page-break-after:avoid}
h2,.pdf-section{font-size:12pt!important;font-weight:700!important;text-align:center!important;margin:14pt 0 8pt!important;letter-spacing:.3pt}
h3,h4,h5,h6,.pdf-clause-title{font-size:11pt!important;font-weight:700!important;text-align:left!important;margin:10pt 0 4pt!important;line-height:1.4}
.pdf-clause-inline{font-weight:700}
section,article{break-inside:auto;page-break-inside:auto}
ul,ol{margin:4pt 0 7pt;padding-left:18pt}li{padding-left:3pt;margin-bottom:4pt;orphans:3;widows:3}
.pdf-lettered{padding-left:18pt;text-indent:-18pt}
.pdf-inventory{margin:3pt 0;line-height:1.6;white-space:pre-wrap;break-inside:avoid;page-break-inside:avoid}
table{border-collapse:collapse;max-width:100%;width:100%;margin:8pt 0}
td,th{padding:5pt;border:1px solid #aaa;vertical-align:top;orphans:3;widows:3}
thead{display:table-header-group}tr{break-inside:auto;page-break-inside:auto}
pre{white-space:pre-wrap}
.pdf-signatures{margin:12mm 0 0!important;table-layout:fixed}
.pdf-signatures,.pdf-signatures *{border:0!important;box-shadow:none!important;background:transparent!important}
.pdf-signatures td,.pdf-signatures th{padding:0 7mm 8mm!important;height:auto!important;text-align:center!important;vertical-align:top;break-inside:avoid;page-break-inside:avoid}
.pdf-signatures p{margin:0 0 3pt!important;text-align:center!important;line-height:1.35}
.pdf-signatures tr{break-inside:avoid;page-break-inside:avoid}
.pdf-signatures-compact{break-inside:avoid;page-break-inside:avoid}
.pdf-signature-label{font-weight:700;text-align:center!important;break-after:avoid;page-break-after:avoid}
.pdf-signature-line{display:block;margin-top:14mm!important;margin-bottom:4pt!important;white-space:nowrap;text-align:center!important;break-after:avoid;page-break-after:avoid}
`;

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
}

export function pdfOptions(folio = "Documento histórico"): NonNullable<Parameters<Page["pdf"]>[0]> {
  return {
    format: "Letter", preferCSSPageSize: true, printBackground: true,
    margin: { ...printMargins }, displayHeaderFooter: true, headerTemplate: "<div></div>",
    footerTemplate: `<div style="width:100%;margin:0 20mm 7mm;font-family:Arial,Helvetica,sans-serif;font-size:8pt;color:#555;display:flex;align-items:center;justify-content:space-between;gap:10mm"><span style="max-width:75%;overflow-wrap:anywhere">${escapeHtml(folio)}</span><span style="white-space:nowrap">Página <span class="pageNumber"></span> de <span class="totalPages"></span></span></div>`,
  };
}
