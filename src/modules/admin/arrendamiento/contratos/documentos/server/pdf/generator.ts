import { chromium } from "playwright-core";
import { chromiumOptions } from "./chromium";
import { printHtml } from "./printHtml";
import { pdfOptions } from "./layout";

export async function generatePdfFromHtml(html: string, options?: { folio: string }): Promise<Uint8Array> {
  const content = printHtml(html);
  const browser = await chromium.launch(await chromiumOptions());
  const deadline = setTimeout(() => { void browser.close().catch(() => {}); }, 30_000);
  try {
    const context = await browser.newContext({ javaScriptEnabled: false, serviceWorkers: "block" });
    await context.route("**/*", route => route.abort());
    const page = await context.newPage();
    page.setDefaultTimeout(15_000);
    await page.setContent(content, { waitUntil: "load", timeout: 15_000 });
    await page.emulateMedia({ media: "print" });
    return await page.pdf(pdfOptions(options?.folio));
  } finally { clearTimeout(deadline); await browser.close(); }
}
