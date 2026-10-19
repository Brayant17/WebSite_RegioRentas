import { existsSync } from "node:fs";
import { isAbsolute } from "node:path";
import { chromium } from "playwright-core";
import { PdfError } from "../errors";

export async function chromiumOptions(env: NodeJS.ProcessEnv = process.env) {
  const configured = env.PDF_CHROMIUM_EXECUTABLE_PATH || import.meta.env?.PDF_CHROMIUM_EXECUTABLE_PATH;
  if (configured) {
    if (!isAbsolute(configured) || !existsSync(configured)) throw new PdfError(500, "CHROMIUM_CONFIGURATION", "PDF_CHROMIUM_EXECUTABLE_PATH debe indicar un ejecutable Chromium existente con ruta absoluta.");
    return { executablePath: configured, headless: true, timeout: 20_000 };
  }
  if (env.VERCEL === "1") {
    const { default: serverless } = await import("@sparticuz/chromium");
    return { executablePath: await serverless.executablePath(), args: serverless.args, headless: true, timeout: 20_000 };
  }
  const executablePath = chromium.executablePath();
  if (!existsSync(executablePath)) throw new PdfError(500, "CHROMIUM_NOT_INSTALLED", "Chromium no está instalado. Ejecuta npx playwright-core install chromium en desarrollo o configura PDF_CHROMIUM_EXECUTABLE_PATH.");
  return { executablePath, headless: true, timeout: 20_000 };
}
