// Turnos fijos (series_turnos): qué fechas materializar (docs/agenda.md,
// "Turnos fijos"). Funciones puras con tests.

import { bloqueoDelDia, diaSemana, type Bloqueo } from "./bloques";
import { sumarDias } from "./calendario";

/** Cuántas semanas hacia adelante se crean los turnos de cada serie. */
export const SEMANAS_A_MATERIALIZAR = 8;

export type Serie = {
  dia_semana: number;
  /** "AAAA-MM-DD": primer día de la serie. */
  desde: string;
  /** "AAAA-MM-DD" o null: último día posible (incluido). */
  hasta: string | null;
};

/**
 * Fechas en las que la serie tiene turno, desde `hoy` y por `semanas` semanas:
 * solo su día de la semana, dentro de desde/hasta, salteando feriados y vacaciones.
 */
export function fechasDeSerie(serie: Serie, hoy: string, bloqueos: Bloqueo[], semanas = SEMANAS_A_MATERIALIZAR): string[] {
  const inicio = serie.desde > hoy ? serie.desde : hoy;
  const limite = sumarDias(hoy, semanas * 7 - 1);
  const fin = serie.hasta && serie.hasta < limite ? serie.hasta : limite;

  // Primera fecha con el día de la semana de la serie.
  let fecha = sumarDias(inicio, (serie.dia_semana - diaSemana(inicio) + 7) % 7);
  const fechas: string[] = [];
  for (; fecha <= fin; fecha = sumarDias(fecha, 7)) {
    if (!bloqueoDelDia(fecha, bloqueos)) fechas.push(fecha);
  }
  return fechas;
}

/** Fechas de un día de la semana para elegir el "hasta" de una serie (un año). */
export function fechasParaHasta(desde: string, semanas = 52): string[] {
  return Array.from({ length: semanas }, (_, i) => sumarDias(desde, i * 7));
}
