// Marcar asistencia y excepciones de un turno (docs/agenda.md "Acciones" y docs/reglas-cobro.md).
// Funciones puras con tests: las usan la pantalla (qué botones mostrar) y el servidor (qué se permite).

import { z } from "zod";

import type { ClaseTurno, EstadoTurno } from "./turnos";

export type AccionTurno =
  | "vino"
  | "no_vino"
  /** Deshacer Vino / No vino: el turno vuelve a 'agendado' y se borra el cargo. */
  | "agendado"
  | "excepcion"
  | "quitar_excepcion"
  | "mover"
  | "cancelar"
  /** Quitar un reservado u ocupado. */
  | "quitar";

/** Las que se guardan con marcarAsistencia (mover, cancelar y quitar tienen su propia acción). */
export const ACCIONES_ASISTENCIA = ["vino", "no_vino", "agendado", "excepcion", "quitar_excepcion"] as const;
export type AccionAsistencia = (typeof ACCIONES_ASISTENCIA)[number];

type TurnoParaAcciones = { clase: ClaseTurno; estado: EstadoTurno; fecha: string; porcentajeManual: number | null };

/**
 * Qué se puede hacer con un turno.
 * - Agendado: Mover y Cancelar; desde el día del turno, también Vino / No vino.
 * - Vino / No vino: pasar al otro, volver a agendado, excepción.
 * - Canceló la familia (con aviso o tarde): solo excepción (el cobro depende del aviso).
 * - Cancelé yo y reprogramado: nada (0%, el cobro va en la reposición o en el turno nuevo).
 */
export function accionesDelTurno(turno: TurnoParaAcciones, hoy: string): AccionTurno[] {
  if (turno.clase !== "turno") return turno.estado === "agendado" ? ["mover", "quitar"] : [];
  const excepcion: AccionTurno[] = turno.porcentajeManual != null ? ["excepcion", "quitar_excepcion"] : ["excepcion"];
  switch (turno.estado) {
    case "agendado":
      return turno.fecha <= hoy ? ["vino", "no_vino", "mover", "cancelar"] : ["mover", "cancelar"];
    case "presente":
      return ["no_vino", "agendado", ...excepcion];
    case "ausente_sin_aviso":
      return ["vino", "agendado", ...excepcion];
    case "ausente_con_aviso":
    case "aviso_tardio":
      return excepcion;
    default:
      return [];
  }
}

export type Excepcion = { porcentaje: number; motivo: string };

const esquemaExcepcion = z.object({
  porcentaje: z
    .number({ error: "Escribí un porcentaje de 0 a 100." })
    .int("El porcentaje va sin decimales.")
    .min(0, "Escribí un porcentaje de 0 a 100.")
    .max(100, "Escribí un porcentaje de 0 a 100."),
  motivo: z.string().trim().min(1, "Escribí el motivo de la excepción.").max(200, "Motivo: hasta 200 letras."),
});

export function validarExcepcion(entrada: unknown): { ok: true; datos: Excepcion } | { ok: false; error: string } {
  const r = esquemaExcepcion.safeParse(entrada);
  if (r.success) return { ok: true, datos: r.data };
  return { ok: false, error: r.error.issues[0]?.message ?? "Faltan datos de la excepción." };
}

export type CambiosAsistencia = {
  estado?: "agendado" | "presente" | "ausente_sin_aviso";
  porcentaje_manual: number | null;
  motivo_excepcion: string | null;
  marcado_en?: string | null;
};

/**
 * Qué se guarda en el turno. Cambiar de estado borra la excepción anterior
 * (la excepción vale para el estado en que se puso).
 */
export function cambiosAsistencia(
  accion: AccionAsistencia,
  excepcion: Excepcion | null,
  ahora: Date,
): CambiosAsistencia {
  const sinExcepcion = { porcentaje_manual: null, motivo_excepcion: null };
  switch (accion) {
    case "vino":
      return { estado: "presente", ...sinExcepcion, marcado_en: ahora.toISOString() };
    case "no_vino":
      return { estado: "ausente_sin_aviso", ...sinExcepcion, marcado_en: ahora.toISOString() };
    case "agendado":
      return { estado: "agendado", ...sinExcepcion, marcado_en: null };
    case "excepcion":
      if (!excepcion) throw new Error("Falta la excepción");
      return { porcentaje_manual: excepcion.porcentaje, motivo_excepcion: excepcion.motivo };
    case "quitar_excepcion":
      return sinExcepcion;
  }
}
