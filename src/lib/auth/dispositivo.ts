// Dispositivo de confianza (funciones puras). Al poner el código del
// Autenticador, el navegador recibe una "llave" en una cookie httpOnly que
// dura 30 días. Mientras dure, alcanza con email y contraseña para entrar.

/** Llave del dispositivo (vive solo en el navegador, nunca en la base). */
export const COOKIE_DISPOSITIVO = "dispositivo";
/** Marca de que la sesión actual entró por un dispositivo de confianza. */
export const COOKIE_SESION_CONFIANZA = "sesion_confianza";

export const DURACION_DISPOSITIVO_MS = 30 * 24 * 60 * 60 * 1000;
/** Solo se recuerda el dispositivo si el código se puso hace menos de 10 minutos. */
export const CODIGO_RECIENTE_MS = 10 * 60 * 1000;

/** 32 bytes en base64url = 43 caracteres. Cualquier otra cosa se descarta. */
export function formatoLlaveValido(llave: string | undefined): llave is string {
  return typeof llave === "string" && /^[A-Za-z0-9_-]{43}$/.test(llave);
}

export function venceDispositivo(ahora: number): Date {
  return new Date(ahora + DURACION_DISPOSITIVO_MS);
}

export function codigoReciente(codigoEn: number | null, ahora: number): boolean {
  return codigoEn !== null && ahora - codigoEn <= CODIGO_RECIENTE_MS && codigoEn <= ahora + 60_000;
}
