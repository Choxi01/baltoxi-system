// Validación del nombre al crear el consultorio.

export const LARGO_MAXIMO_NOMBRE = 80;

export type ResultadoNombre = { ok: true; nombre: string } | { ok: false; error: string };

export function validarNombreConsultorio(texto: unknown): ResultadoNombre {
  const nombre = typeof texto === "string" ? texto.trim().replace(/\s+/g, " ") : "";
  if (!nombre) return { ok: false, error: "Escribí el nombre del consultorio." };
  if (nombre.length > LARGO_MAXIMO_NOMBRE) {
    return { ok: false, error: `El nombre puede tener hasta ${LARGO_MAXIMO_NOMBRE} letras.` };
  }
  return { ok: true, nombre };
}
