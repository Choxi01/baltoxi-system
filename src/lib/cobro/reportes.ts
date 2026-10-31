// Reportes (docs/reglas-cobro.md sección 8). Fechas "AAAA-MM-DD", rangos con los dos extremos incluidos.

import type { Cargo, EstadoTurno, Pago, TipoTurno } from "./tipos";

const sumaEnRango = (xs: { fecha: string; monto_gs: number }[], desde: string, hasta: string) =>
  xs.filter((x) => x.fecha >= desde && x.fecha <= hasta).reduce((s, x) => s + x.monto_gs, 0);

/** Generado (día o mes) = suma de cargos con fecha en el rango. */
export function generado(cargos: Pick<Cargo, "fecha" | "monto_gs">[], desde: string, hasta: string): number {
  return sumaEnRango(cargos, desde, hasta);
}

/** Cobrado = suma de pagos con fecha en el rango. */
export function cobrado(pagos: Pick<Pago, "fecha" | "monto_gs">[], desde: string, hasta: string): number {
  return sumaEnRango(pagos, desde, hasta);
}

export const HISTORIA_MINIMA = 20;

/**
 * Tasa de ausencias sin cobro de los últimos 3 meses (pasá solo esos turnos).
 * Cuenta los turnos ya marcados (sin 'agendado' ni 'reprogramado'); "sin cobro" = su cargo dio 0.
 * Con menos de 20 turnos de historia, la tasa es 0.
 */
export function tasaAusenciasSinCobro(turnos: { estado: EstadoTurno; monto_cargo: number }[]): number {
  const marcados = turnos.filter((t) => t.estado !== "agendado" && t.estado !== "reprogramado");
  if (marcados.length < HISTORIA_MINIMA) return 0;
  return marcados.filter((t) => t.monto_cargo === 0).length / marcados.length;
}

/** Proyección = generado del mes + Σ(monto base de los agendados que quedan) × (1 − tasa). */
export function proyeccionMes({
  generado: generadoMes,
  montosBaseAgendados,
  tasa,
}: {
  generado: number;
  montosBaseAgendados: number[];
  tasa: number;
}): number {
  const pendiente = montosBaseAgendados.reduce((s, m) => s + m, 0);
  return generadoMes + Math.round(pendiente * (1 - tasa));
}

/** Horas trabajadas = turnos 'presente' + bloques ocupados de reunión (tipo sin paciente) o colegio. */
export function horasTrabajadas(
  turnos: {
    clase: "turno" | "reservado" | "ocupado";
    estado: EstadoTurno;
    inicio: Date | string;
    fin: Date | string;
    tipoTurno: Pick<TipoTurno, "requiere_paciente" | "modalidad"> | null;
  }[],
): number {
  const minutos = turnos
    .filter(
      (t) =>
        (t.clase === "turno" && t.estado === "presente") ||
        (t.clase === "ocupado" &&
          t.tipoTurno != null &&
          (t.tipoTurno.requiere_paciente === false || t.tipoTurno.modalidad === "colegio")),
    )
    .reduce((s, t) => s + (new Date(t.fin).getTime() - new Date(t.inicio).getTime()) / 60_000, 0);
  return minutos / 60;
}
