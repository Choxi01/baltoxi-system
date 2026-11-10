// Respuestas de una anamnesis (tarea A6b). DATO CLÍNICO (regla de oro 7): los errores nombran la
// pregunta (es de la plantilla) pero nunca lo que se respondió. Funciones puras con tests.
//
// Formato guardado en `anamnesis.respuestas`: {campo_id: valor}. Texto, opciones y fecha son string
// (fecha "AAAA-MM-DD"); Sí / No es boolean. Lo vacío no se guarda.

import { textoFecha } from "@/lib/pacientes/fecha";
import { lugarDelError, type Campo, type Estructura } from "./estructura";

export type Respuesta = string | boolean;
export type Respuestas = Record<string, Respuesta>;

export const MAXIMO_RESPUESTA = { texto: 1000, largo: 10000 } as const;

const FORMATO_FECHA = /^\d{4}-\d{2}-\d{2}$/;

function esFechaValida(valor: string): boolean {
  if (!FORMATO_FECHA.test(valor)) return false;
  const d = new Date(`${valor}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(valor);
}

type Limpia = { ok: true; valor: Respuesta | undefined } | { ok: false; error: string };

/** Revisa una respuesta según el tipo de su pregunta. `valor: undefined` = sin responder. */
export function limpiarRespuesta(campo: Campo, valor: unknown): Limpia {
  if (valor === undefined || valor === null) return { ok: true, valor: undefined };
  switch (campo.tipo) {
    case "si_no":
      return typeof valor === "boolean" ? { ok: true, valor } : { ok: false, error: "Elegí Sí o No." };
    case "texto":
    case "largo": {
      if (typeof valor !== "string") return { ok: false, error: "Respuesta inválida." };
      if (valor.trim() === "") return { ok: true, valor: undefined };
      const maximo = MAXIMO_RESPUESTA[campo.tipo];
      return valor.length > maximo ? { ok: false, error: `Puede tener hasta ${maximo} letras.` } : { ok: true, valor };
    }
    case "opciones":
      if (valor === "") return { ok: true, valor: undefined };
      return typeof valor === "string" && campo.opciones?.includes(valor)
        ? { ok: true, valor }
        : { ok: false, error: "Elegí una de las opciones." };
    case "fecha":
      if (valor === "") return { ok: true, valor: undefined };
      return typeof valor === "string" && esFechaValida(valor) ? { ok: true, valor } : { ok: false, error: "Fecha inválida." };
  }
}

/**
 * Valida lo que llega del formulario contra la estructura copiada en la anamnesis. Las preguntas
 * que no están en la estructura y las respuestas vacías se descartan.
 */
export function validarRespuestas(estructura: Estructura, valor: unknown): { ok: true; respuestas: Respuestas } | { ok: false; error: string } {
  if (typeof valor !== "object" || valor === null || Array.isArray(valor)) return { ok: false, error: "Respuestas inválidas." };
  const entrada = valor as Record<string, unknown>;
  const respuestas: Respuestas = {};
  for (const [i, seccion] of estructura.secciones.entries()) {
    for (const [j, campo] of seccion.campos.entries()) {
      if (!Object.hasOwn(entrada, campo.id)) continue;
      const r = limpiarRespuesta(campo, entrada[campo.id]);
      if (!r.ok) return { ok: false, error: `${lugarDelError(["secciones", i, "campos", j])}${r.error}` };
      if (r.valor !== undefined) respuestas[campo.id] = r.valor;
    }
  }
  return { ok: true, respuestas };
}

/** Lo guardado en la base, sin lo que no encaja (por si algo quedó raro): nunca falla. */
export function leerRespuestas(estructura: Estructura, valor: unknown): Respuestas {
  if (typeof valor !== "object" || valor === null || Array.isArray(valor)) return {};
  const entrada = valor as Record<string, unknown>;
  const respuestas: Respuestas = {};
  for (const campo of estructura.secciones.flatMap((s) => s.campos)) {
    const r = limpiarRespuesta(campo, entrada[campo.id]);
    if (r.ok && r.valor !== undefined) respuestas[campo.id] = r.valor;
  }
  return respuestas;
}

/** Cómo se lee una respuesta en la vista para imprimir. `null`: sin responder. */
export function textoRespuesta(campo: Campo, valor: Respuesta | undefined): string | null {
  if (valor === undefined) return null;
  if (typeof valor === "boolean") return valor ? "Sí" : "No";
  return campo.tipo === "fecha" ? textoFecha(valor) : valor;
}

/** "5 de 12 respondidas" */
export function progresoRespuestas(estructura: Estructura, respuestas: Respuestas): string {
  const campos = estructura.secciones.flatMap((s) => s.campos);
  const n = campos.filter((c) => respuestas[c.id] !== undefined).length;
  return `${n} de ${campos.length} respondidas`;
}
