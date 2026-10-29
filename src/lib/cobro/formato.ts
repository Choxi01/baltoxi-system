// Guaraníes: siempre enteros (regla de oro 1). Formato "Gs. 290.000".

export function formatoGs(monto: number): string {
  if (!Number.isSafeInteger(monto)) throw new Error("El monto en guaraníes tiene que ser un entero");
  const signo = monto < 0 ? "-" : "";
  const miles = Math.abs(monto).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${signo}Gs. ${miles}`;
}

/**
 * Lee un monto escrito a mano: "290.000", "Gs. 290.000", "290000".
 * Devuelve null si está vacío o no es un entero (no se aceptan decimales).
 */
export function leerGs(texto: string): number | null {
  const limpio = texto.replace(/gs\.?/i, "").replace(/\s/g, "");
  if (!/^\d{1,3}(\.\d{3})*$|^\d+$/.test(limpio)) return null;
  const monto = Number(limpio.replace(/\./g, ""));
  return Number.isSafeInteger(monto) ? monto : null;
}
