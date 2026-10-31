// Qué hacer con el cargo de un turno cuando cambia su estado (docs/reglas-cobro.md sección 4).
// Funciones puras con tests. La escritura en la base está en aplicar-estado.ts.

import type { CargoCalculado } from "./cargo";

/** Aviso único cuando el mes del turno está cerrado (regla de oro 5): no se toca nada. */
export const MES_CERRADO = "Ese mes está cerrado: no se puede cambiar";

export type AccionCargo = "crear" | "actualizar" | "borrar" | "nada";

/**
 * Un cargo por turno: si no había y ahora corresponde, se crea; si había, se actualiza
 * (aunque quede en 0); si ya no corresponde (volvió a 'agendado'), se borra.
 */
export function accionCargo(existente: { id: string } | null, calculado: CargoCalculado | null): AccionCargo {
  if (!existente) return calculado ? "crear" : "nada";
  return calculado ? "actualizar" : "borrar";
}

/** "Sesión 05/11/2026": solo el tipo de turno y la fecha, nunca datos clínicos (regla de oro 7). */
export function conceptoCargo(tipoNombre: string | null, fecha: string): string {
  const [a, m, d] = fecha.split("-");
  return `${tipoNombre?.trim() || "Sesión"} ${d}/${m}/${a}`;
}

/** Las columnas del cargo que salen del cálculo (sin ids: los pone el que guarda). */
export function datosCargo(calculado: CargoCalculado, tipoNombre: string | null) {
  return {
    tipo: "sesion" as const,
    tutor_id: calculado.tutor_id,
    fecha: calculado.fecha,
    periodo: calculado.periodo,
    concepto: conceptoCargo(tipoNombre, calculado.fecha),
    monto_gs: calculado.monto,
    snapshot: calculado.snapshot,
  };
}

/** Errores del motor → qué tiene que completar la profesional. */
export function mensajeErrorCobro(error: unknown): string {
  const texto = error instanceof Error ? error.message : "";
  if (texto.includes("responsable de pago")) return "El paciente no tiene responsable de pago: completalo en el expediente.";
  if (texto.includes("no tiene tarifa")) return "El paciente no tiene tarifa: completala en el expediente.";
  if (texto.includes("tarifa del turno")) return "No se encontró la tarifa de este tipo de turno: revisala en Configuración.";
  if (texto.includes("regla de cobro")) return "Falta una regla de cobro para ese estado: revisala en Configuración.";
  if (texto.includes("está cerrado")) return MES_CERRADO;
  return "No se pudo calcular el cobro. Probá de nuevo.";
}
