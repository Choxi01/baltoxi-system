// Tiempos de la sesión (funciones puras):
// - 24 h sin usar la app → se "bloquea": pide solo el código del Autenticador.
// - 30 días desde que puso la contraseña → se cierra: pide contraseña + código.
// - En otro dispositivo no hay sesión, así que siempre pide las dos cosas.

export const COOKIE_ULTIMO_USO = "ultimo_uso"; // ms del último pedido
export const COOKIE_BLOQUEO = "bloqueo_desde"; // ms en que se bloqueó (si está bloqueada)

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

export type EvaluacionSesion =
  | { accion: "cerrar" }
  | { accion: "seguir"; bloqueadaDesde: number | null };

export function evaluarSesion(datos: {
  ahora: number;
  ultimoUso: number | null;
  bloqueadaDesde: number | null;
  contrasenaEn: number | null;
  codigoEn: number | null;
}): EvaluacionSesion {
  const { ahora, ultimoUso, contrasenaEn, codigoEn } = datos;

  if (contrasenaEn !== null && ahora - contrasenaEn > LIMITE_SESION_MS) return { accion: "cerrar" };

  let bloqueadaDesde = datos.bloqueadaDesde;
  if (bloqueadaDesde === null && ultimoUso !== null && ahora - ultimoUso > LIMITE_INACTIVIDAD_MS) {
    bloqueadaDesde = ahora;
  }
  // Se desbloquea si puso el código después del bloqueo. Supabase guarda
  // segundos, así que comparamos contra el segundo en que se bloqueó.
  if (bloqueadaDesde !== null && codigoEn !== null && codigoEn >= Math.floor(bloqueadaDesde / 1000) * 1000) {
    bloqueadaDesde = null;
  }
  return { accion: "seguir", bloqueadaDesde };
}
