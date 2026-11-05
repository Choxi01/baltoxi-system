// Notas de sesión del expediente (tarea A5, docs/expediente.md "Notas").
// DATOS CLÍNICOS (regla de oro 7): el texto de una nota solo se muestra dentro del expediente.
// Nunca en mensajes, reportes, logs ni URLs. Funciones puras con tests.

import { z } from "zod";

import type { ErroresFormulario } from "./validacion";

export const MAXIMO_NOTA = 10000;

export type Nota = {
  id: string;
  fecha: string;
  texto: string;
  fijada: boolean;
  turno_id: string | null;
  creado_en: string;
  actualizado_en: string;
};

const esquemaNota = (hoy: string) =>
  z.object({
    texto: z
      .string()
      .trim()
      .min(1, "Escribí la nota.")
      .max(MAXIMO_NOTA, `La nota puede tener hasta ${MAXIMO_NOTA.toLocaleString("es-PY")} letras.`),
    fecha: z
      .string()
      .refine(esFecha, "Elegí la fecha de la nota.")
      // Las fechas "AAAA-MM-DD" se comparan bien como texto.
      .refine((f) => f <= hoy, "La fecha no puede ser futura."),
  });

export type DatosNota = { texto: string; fecha: string };

/** "AAAA-MM-DD" que exista (no 31 de febrero). */
function esFecha(valor: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor);
  if (!m) return false;
  const [a, mes, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const prueba = new Date(Date.UTC(a, mes - 1, d));
  return prueba.getUTCFullYear() === a && prueba.getUTCMonth() === mes - 1 && prueba.getUTCDate() === d;
}

/** `hoy`: "AAAA-MM-DD" en Asunción (no se puede anotar una sesión que todavía no pasó). */
export function validarNota(formulario: FormData, hoy: string): { ok: true; datos: DatosNota } | { ok: false; errores: ErroresFormulario } {
  const resultado = esquemaNota(hoy).safeParse({
    texto: String(formulario.get("texto") ?? ""),
    fecha: String(formulario.get("fecha") ?? ""),
  });
  if (resultado.success) return { ok: true, datos: resultado.data };
  const errores: ErroresFormulario = {};
  for (const problema of resultado.error.issues) errores[String(problema.path[0] ?? "general")] ??= problema.message;
  return { ok: false, errores };
}

/** La más nueva arriba: por fecha y, el mismo día, la última que se escribió. */
function masNuevaPrimero(a: Nota, b: Nota): number {
  if (a.fecha !== b.fecha) return a.fecha < b.fecha ? 1 : -1;
  return a.creado_en < b.creado_en ? 1 : a.creado_en > b.creado_en ? -1 : 0;
}

/**
 * Separa la nota fijada (va arriba de la ficha) del resto, ordenado de la más nueva a la más vieja.
 * Hay una sola fijada por paciente; si por algún motivo hubiera más, se toma la más nueva y las
 * otras quedan en la lista.
 */
export function ordenarNotas(notas: Nota[]): { fijada: Nota | null; resto: Nota[] } {
  const ordenadas = [...notas].sort(masNuevaPrimero);
  const fijada = ordenadas.find((n) => n.fijada) ?? null;
  return { fijada, resto: ordenadas.filter((n) => n !== fijada) };
}

/** Si la nota se editó después de escribirla (más de un minuto), para mostrar "Editada". */
export function fueEditada(nota: Pick<Nota, "creado_en" | "actualizado_en">): boolean {
  return new Date(nota.actualizado_en).getTime() - new Date(nota.creado_en).getTime() > 60_000;
}
