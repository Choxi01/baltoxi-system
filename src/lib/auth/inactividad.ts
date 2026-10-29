// La sesión vence tras 12 horas sin uso. Guardamos en una cookie la hora del
// último pedido (milisegundos) y la comparamos con la hora actual.

export const COOKIE_ULTIMO_USO = "ultimo_uso";
export const LIMITE_INACTIVIDAD_MS = 12 * 60 * 60 * 1000;

/** Lee el valor de la cookie; devuelve null si falta o no es un número válido. */
export function leerUltimoUso(valor: string | undefined): number | null {
  if (!valor || !/^\d+$/.test(valor)) return null;
  const ms = Number(valor);
  return Number.isSafeInteger(ms) ? ms : null;
}

/**
 * true si pasaron más de 12 h desde el último uso.
 * Sin dato (primer pedido después de entrar) no se considera vencida.
 */
export function sesionVencida(
  ultimoUso: number | null,
  ahora: number,
  limiteMs: number = LIMITE_INACTIVIDAD_MS,
): boolean {
  if (ultimoUso === null) return false;
  return ahora - ultimoUso > limiteMs;
}
