// Monto base, porcentaje y cargo de un turno (docs/reglas-cobro.md secciones 2, 3 y 4).

import { hoyEnAsuncion } from "@/lib/fechas";
import { inicioDeMes } from "@/lib/agenda/calendario";
import type {
  EstadoConRegla,
  OrigenRegla,
  Paciente,
  ReglaCobro,
  SnapshotCargo,
  Tarifa,
  TipoTurno,
  Turno,
} from "./tipos";

export const PRECIO_ESPECIAL = "precio especial";

/**
 * Monto base: la tarifa del tipo de turno (domicilio, evaluación, colegio); si no tiene,
 * el precio especial del paciente; si no, la tarifa del paciente.
 */
export function montoBase({
  tipoTurno,
  paciente,
  tarifas,
}: {
  tipoTurno: Pick<TipoTurno, "tarifa_id">;
  paciente: Pick<Paciente, "tarifa_id" | "monto_override_gs">;
  tarifas: Tarifa[];
}): { monto: number; tarifa: string } {
  const buscar = (id: string): Tarifa => {
    const t = tarifas.find((x) => x.id === id);
    if (!t) throw new Error("No se encontró la tarifa del turno");
    return t;
  };
  if (tipoTurno.tarifa_id) {
    const t = buscar(tipoTurno.tarifa_id);
    return { monto: t.monto_gs, tarifa: t.nombre };
  }
  if (paciente.monto_override_gs != null) return { monto: paciente.monto_override_gs, tarifa: PRECIO_ESPECIAL };
  if (!paciente.tarifa_id) throw new Error("El paciente no tiene tarifa");
  const t = buscar(paciente.tarifa_id);
  return { monto: t.monto_gs, tarifa: t.nombre };
}

/** Porcentaje: excepción manual > regla del paciente > regla del consultorio. Sin regla, error. */
export function porcentajeAplicable({
  turno,
  pacienteId,
  reglas,
}: {
  turno: Pick<Turno, "estado" | "porcentaje_manual">;
  pacienteId: string;
  reglas: ReglaCobro[];
}): { porcentaje: number; origen: OrigenRegla } {
  if (turno.porcentaje_manual != null) return { porcentaje: turno.porcentaje_manual, origen: "manual" };
  const delPaciente = reglas.find((r) => r.estado === turno.estado && r.paciente_id === pacienteId);
  if (delPaciente) return { porcentaje: delPaciente.porcentaje, origen: "paciente" };
  const general = reglas.find((r) => r.estado === turno.estado && r.paciente_id == null);
  if (general) return { porcentaje: general.porcentaje, origen: "consultorio" };
  throw new Error(`Falta la regla de cobro para el estado "${turno.estado}"`);
}

export type CargoCalculado = {
  monto: number;
  porcentaje: number;
  snapshot: SnapshotCargo;
  fecha: string;
  periodo: string;
  tutor_id: string;
};

/**
 * Cargo de un turno. `null` si no corresponde cargo (no es turno de paciente, el tipo no genera
 * cobro o sigue 'agendado'). Se devuelve aunque el monto sea 0, para que aparezca en el detalle.
 */
export function calcularCargoTurno({
  turno,
  tipoTurno,
  paciente,
  montoBase: base,
  reglas,
}: {
  turno: Turno;
  tipoTurno: Pick<TipoTurno, "genera_cobro">;
  paciente: Pick<Paciente, "id" | "responsable_pago_id">;
  montoBase: { monto: number; tarifa: string };
  reglas: ReglaCobro[];
}): CargoCalculado | null {
  if (turno.clase !== "turno" || !tipoTurno.genera_cobro || turno.estado === "agendado") return null;
  if (!paciente.responsable_pago_id) throw new Error("El paciente no tiene responsable de pago");
  const { porcentaje, origen } = porcentajeAplicable({ turno, pacienteId: paciente.id, reglas });
  const monto = Math.round((base.monto * porcentaje) / 100);
  const fecha = hoyEnAsuncion(new Date(turno.inicio));
  return {
    monto,
    porcentaje,
    snapshot: {
      tarifa: base.tarifa,
      monto_base: base.monto,
      estado: turno.estado as EstadoConRegla,
      porcentaje,
      origen_regla: origen,
    },
    fecha,
    periodo: inicioDeMes(fecha),
    tutor_id: paciente.responsable_pago_id,
  };
}
