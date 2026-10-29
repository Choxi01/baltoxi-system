// Tiempos de la sesión (funciones puras):
// - 24 h sin usar la app → se cierra. En un dispositivo de confianza vuelve a
//   pedir solo email y contraseña (ver dispositivo.ts).
// - 30 días desde que puso la contraseña → se cierra igual.

export const COOKIE_ULTIMO_USO = "ultimo_uso"; // ms del último pedido

const HORA_MS = 60 * 60 * 1000;
export const LIMITE_INACTIVIDAD_MS = 24 * HORA_MS;
export const LIMITE_SESION_MS = 30 * 24 * HORA_MS;

/** Lee un valor de cookie en milisegundos; null si falta o no es un número válido. */
export function leerMilisegundos(valor: string | undefined): number | null {
  if (!valor || !/^\d+$/.test(valor)) return null;
  const ms = Number(valor);
  return Number.isSafeInteger(ms) ? ms : null;
}

type EntradaAmr = { method: string; timestamp: number } | string;

/**
 * Supabase anota en la sesión ("amr") cuándo se usó cada método, en segundos.
 * Devuelve cuándo puso la contraseña y la última vez que puso el código (en ms).
 */
export function momentosDeIngreso(amr: EntradaAmr[] | undefined): {
  contrasenaEn: number | null;
  codigoEn: number | null;
} {
  let contrasenaEn: number | null = null;
  let codigoEn: number | null = null;
  for (const entrada of amr ?? []) {
    if (typeof entrada === "string") continue;
    const ms = entrada.timestamp * 1000;
    if (entrada.method === "password") contrasenaEn = Math.min(contrasenaEn ?? ms, ms);
    if (entrada.method === "totp") codigoEn = Math.max(codigoEn ?? ms, ms);
  }
  return { contrasenaEn, codigoEn };
}

/** true si hay que cerrar la sesión: 24 h sin uso o 30 días desde la contraseña. */
export function sesionVencida(datos: {
  ahora: number;
  ultimoUso: number | null;
  contrasenaEn: number | null;
}): boolean {
  const { ahora, ultimoUso, contrasenaEn } = datos;
  if (ultimoUso !== null && ahora - ultimoUso > LIMITE_INACTIVIDAD_MS) return true;
  if (contrasenaEn !== null && ahora - contrasenaEn > LIMITE_SESION_MS) return true;
  return false;
}
