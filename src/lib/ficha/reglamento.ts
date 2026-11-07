// Reglamento del consultorio (tarea A8b, docs/expediente.md "Ficha online para familias").
// La profesional lo edita en Configuración; la familia lo acepta en la ficha online con nombre
// completo, cédula y "Leí y acepto". Funciones puras con tests.

import { z } from "zod";

export const MAXIMO_REGLAMENTO = 20000;

/** Saca espacios de más al final de cada línea y al principio y fin del texto. */
export function normalizarReglamento(texto: string): string {
  return texto
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((linea) => linea.trimEnd())
    .join("\n")
    .trim();
}

/**
 * Qué guardar al editar el reglamento. La versión sube solo si el texto cambió y antes había
 * texto (con el reglamento vacío nadie pudo firmar, así que la primera carga queda en la misma versión).
 */
export function guardarReglamento(
  anterior: { texto: string | null; version: number },
  nuevo: string,
): { texto: string | null; version: number; cambio: boolean } {
  const textoNuevo = normalizarReglamento(nuevo);
  const textoAnterior = normalizarReglamento(anterior.texto ?? "");
  if (textoNuevo === textoAnterior) return { texto: anterior.texto, version: anterior.version, cambio: false };
  const version = textoAnterior === "" ? anterior.version : anterior.version + 1;
  return { texto: textoNuevo === "" ? null : textoNuevo, version, cambio: true };
}

const esquemaFirma = z.object({
  nombre: z.string().trim().min(3, "Escribí tu nombre completo.").max(120, "Nombre: hasta 120 letras."),
  cedula: z
    .string()
    .transform((v) => v.replace(/[.\s-]/g, ""))
    .refine((v) => /^\d{5,9}$/.test(v), "Escribí tu número de cédula (solo números)."),
  acepto: z.literal("on", "Marcá «Leí y acepto» para continuar."),
});

export type DatosFirma = { nombre: string; cedula: string };

/** Nombre completo, cédula (sin puntos) y el tilde "Leí y acepto". */
export function validarFirma(formulario: FormData): { ok: true; datos: DatosFirma } | { ok: false; errores: Partial<Record<string, string>> } {
  const resultado = esquemaFirma.safeParse({
    nombre: String(formulario.get("nombre") ?? ""),
    cedula: String(formulario.get("cedula") ?? ""),
    acepto: String(formulario.get("acepto") ?? ""),
  });
  if (resultado.success) return { ok: true, datos: { nombre: resultado.data.nombre, cedula: resultado.data.cedula } };
  const errores: Partial<Record<string, string>> = {};
  for (const problema of resultado.error.issues) errores[String(problema.path[0] ?? "general")] ??= problema.message;
  return { ok: false, errores };
}

export type Firma = { version: number; aceptado_en: string; nombre_firmante: string };

export type EstadoFirma =
  | { tipo: "sin_reglamento" }
  | { tipo: "al_dia"; firma: Firma }
  | { tipo: "version_vieja"; firma: Firma }
  | { tipo: "sin_firmar" };

/** Cómo está un tutor con el reglamento actual: firmó esta versión, una anterior o ninguna. */
export function estadoFirma(firmas: Firma[], reglamento: { texto: string | null; version: number }): EstadoFirma {
  if (!reglamento.texto?.trim()) return { tipo: "sin_reglamento" };
  const ultima = [...firmas].sort((a, b) => b.version - a.version || (a.aceptado_en < b.aceptado_en ? 1 : -1))[0];
  if (!ultima) return { tipo: "sin_firmar" };
  return ultima.version >= reglamento.version ? { tipo: "al_dia", firma: ultima } : { tipo: "version_vieja", firma: ultima };
}

/** "7/11/2026" en Asunción. */
export function fechaCorta(instante: string): string {
  return new Date(instante).toLocaleDateString("es-PY", { timeZone: "America/Asuncion", day: "numeric", month: "numeric", year: "numeric" });
}

/** Texto para el expediente. Sin reglamento cargado: null (no se muestra). */
export function textoEstadoFirma(estado: EstadoFirma, versionActual: number): string | null {
  switch (estado.tipo) {
    case "sin_reglamento":
      return null;
    case "sin_firmar":
      return "Sin aceptar";
    case "al_dia":
      return `Aceptado el ${fechaCorta(estado.firma.aceptado_en)} (versión ${estado.firma.version})`;
    case "version_vieja":
      return `Aceptó la versión ${estado.firma.version}; falta aceptar la ${versionActual}`;
  }
}
