// Pantalla Hoy: resumen del día. Función pura con tests.

import type { TurnoAgenda } from "./turnos";

/** Cuántos turnos hay hoy (todos, también cancelados) y cuántos con paciente falta marcar. */
export function resumenHoy(turnos: Pick<TurnoAgenda, "clase" | "estado">[]): { total: number; porMarcar: number } {
  return {
    total: turnos.length,
    porMarcar: turnos.filter((t) => t.clase === "turno" && t.estado === "agendado").length,
  };
}

/** "4 turnos · 2 por marcar", "1 turno · todo marcado". Sin turnos: null. */
export function textoResumenHoy({ total, porMarcar }: { total: number; porMarcar: number }): string | null {
  if (total === 0) return null;
  const turnos = total === 1 ? "1 turno" : `${total} turnos`;
  return `${turnos} · ${porMarcar === 0 ? "todo marcado" : `${porMarcar} por marcar`}`;
}
