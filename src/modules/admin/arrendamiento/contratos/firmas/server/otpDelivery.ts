export interface OtpDelivery { deliver(input: { folio: string | null; correoParcial: string; code: string; expiresAt: string }): void }

// Imprime el código en la terminal del servidor de desarrollo. Nunca sale en una respuesta HTTP ni llega a un correo.
export function consoleOtpDelivery(log: (text: string) => void = console.info): OtpDelivery {
  return { deliver({ folio, correoParcial, code, expiresAt }) { log(`[firma-otp-dev] Código ${code} · contrato ${folio ?? "sin folio"} · firmante ${correoParcial} · vence ${expiresAt}`); } };
}

// Sin proveedor de correo, el único canal es la consola: exige una compilación de desarrollo y activarla de forma expresa.
// null significa que no hay canal: no se genera ningún código, así que en producción no se puede firmar todavía.
export function selectOtpDelivery(config: { dev: boolean; enabled: boolean }): OtpDelivery | null {
  return config.dev && config.enabled ? consoleOtpDelivery() : null;
}
