// Código de 6 dígitos de la app Autenticador.

/** Deja solo números (el teclado del iPhone a veces pega espacios) y corta en 6. */
export function limpiarCodigo(texto: string): string {
  return texto.replace(/\D/g, "").slice(0, 6);
}

export function codigoCompleto(codigo: string): boolean {
  return /^\d{6}$/.test(codigo);
}
