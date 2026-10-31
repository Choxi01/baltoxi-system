// Próximo día de atención (para los recordatorios de "Mensajes de hoy").
// Función pura: sin Supabase ni zona horaria del navegador.

import { bloqueoDelDia, diaSemana, type Bloqueo, type Tramo } from "./bloques";
import { sumarDias } from "./calendario";

/** Hasta cuántos días adelante se busca (vacaciones largas). */
export const DIAS_A_BUSCAR = 60;

/**
 * El primer día después de `hoy` que tiene horario de atención y no es feriado ni vacaciones.
 * El viernes da el lunes; la víspera de un feriado saltea el feriado. Sin ninguno: null.
 */
export function proximoDiaDeAtencion(hoy: string, tramos: Pick<Tramo, "dia_semana">[], bloqueos: Bloqueo[]): string | null {
  const dias = new Set(tramos.map((t) => t.dia_semana));
  if (dias.size === 0) return null;
  for (let i = 1; i <= DIAS_A_BUSCAR; i++) {
    const fecha = sumarDias(hoy, i);
    if (dias.has(diaSemana(fecha)) && !bloqueoDelDia(fecha, bloqueos)) return fecha;
  }
  return null;
}
