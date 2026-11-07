// Turnos de un paciente para la pestaña "Turnos y cuenta" del expediente. Funciones puras.

import { NOMBRE_ESTADO_TURNO, type EstadoTurno } from "@/lib/agenda/turnos";

/** `fecha` y `hora` de Asunción ("AAAA-MM-DD", "HH:MM"). */
export type TurnoPaciente = { id: string; estado: string; fecha: string; hora: string; tipo: string | null };

const porMomento = (a: TurnoPaciente, b: TurnoPaciente) => a.fecha.localeCompare(b.fecha) || a.hora.localeCompare(b.hora);

/**
 * Próximos: los agendados que todavía no empezaron, el más cercano primero.
 * Historial: todo lo demás, lo más nuevo arriba. Un agendado que ya pasó queda ahí como "Sin marcar".
 */
export function separarTurnos(
  turnos: TurnoPaciente[],
  ahora: { fecha: string; hora: string },
): { proximos: TurnoPaciente[]; historial: TurnoPaciente[] } {
  const esProximo = (t: TurnoPaciente) =>
    t.estado === "agendado" && (t.fecha > ahora.fecha || (t.fecha === ahora.fecha && t.hora >= ahora.hora));
  return {
    proximos: turnos.filter(esProximo).sort(porMomento),
    historial: turnos.filter((t) => !esProximo(t)).sort((a, b) => porMomento(b, a)),
  };
}

/** Asistencia de un turno del historial: "Vino", "No vino"… */
export function textoAsistencia(estado: string): string {
  if (estado === "agendado") return "Sin marcar";
  return NOMBRE_ESTADO_TURNO[estado as EstadoTurno] ?? estado;
}
