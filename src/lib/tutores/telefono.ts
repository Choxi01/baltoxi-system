// WhatsApp de Paraguay en formato internacional sin "+": 595 + número sin el 0.
// Así se arma el link wa.me/595981123456.

/**
 * "0981 123 456", "+595 981-123456", "981123456" → "595981123456".
 * Vacío → null. Devuelve "invalido" si no parece un número de Paraguay.
 */
export function normalizarTelefono(texto: string): string | null | "invalido" {
  const digitos = texto.replace(/\D/g, "");
  if (digitos === "") return null;
  let nacional: string;
  if (digitos.startsWith("595")) nacional = digitos.slice(3);
  else if (digitos.startsWith("0")) nacional = digitos.slice(1);
  else nacional = digitos;
  nacional = nacional.replace(/^0+/, "");
  // Celulares: 9 dígitos que empiezan con 9 (981 123 456). Fijos: 8 o 9 dígitos (21 123 456).
  if (!/^\d{8,9}$/.test(nacional)) return "invalido";
  return `595${nacional}`;
}

/** "595981123456" → "0981 123 456" (para mostrar). */
export function mostrarTelefono(internacional: string | null): string | null {
  if (!internacional) return null;
  const nacional = "0" + internacional.replace(/^595/, "");
  return nacional.length === 10 ? `${nacional.slice(0, 4)} ${nacional.slice(4, 7)} ${nacional.slice(7)}` : nacional;
}
