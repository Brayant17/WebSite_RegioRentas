import { templateText } from "./formatters";

export function escapeHtml(value: unknown): string {
  const entities: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;", "`": "&#96;", "=": "&#61;", " ": "&#32;" };
  // También escapa espacios, = y ` para no abrir atributos aun en HTML sin comillas.
  return templateText(value).replace(/[&<>"'`= ]/g, character => entities[character]);
}
