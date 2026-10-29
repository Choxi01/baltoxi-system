// Dígito verificador (DV) del RUC de Paraguay: módulo 11 de la SET.

/** DV de un RUC (solo el número, sin DV). Devuelve null si no son solo dígitos. */
export function calcularDv(ruc: string, baseMaxima = 11): number | null {
  const limpio = ruc.replace(/\./g, "").trim();
  if (!/^\d{1,9}$/.test(limpio)) return null;
  let factor = 2;
  let suma = 0;
  for (const digito of [...limpio].reverse()) {
    suma += Number(digito) * factor;
    factor = factor === baseMaxima ? 2 : factor + 1;
  }
  const resto = suma % 11;
  return resto > 1 ? 11 - resto : 0;
}
