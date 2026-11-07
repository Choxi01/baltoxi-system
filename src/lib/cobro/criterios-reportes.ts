// Criterios de Reportes que Daniela TODAVÍA NO CONFIRMÓ (docs/reglas-cobro.md sección 8).
// Si dice otra cosa, se cambia solo este archivo: las funciones de reportes.ts los leen de acá.

import type { EstadoTurno, TipoTurno } from "./tipos";

export type CriterioHoras = {
  /** Estados de un turno con paciente que suman horas. */
  estadosTurno: EstadoTurno[];
  /**
   * Un bloque "Marcar ocupado" no tiene tipo de turno, solo un motivo escrito a mano: suma horas si el
   * motivo contiene alguna de estas palabras. Escribilas sin acentos y en minúscula.
   */
  palabrasOcupado: string[];
  /** Un bloque ocupado que sí tiene tipo de turno (hoy solo pasa en los datos de prueba). */
  ocupadoPorTipo: (tipo: Pick<TipoTurno, "requiere_paciente" | "modalidad">) => boolean;
};

export const CRITERIO_HORAS: CriterioHoras = {
  estadosTurno: ["presente"],
  palabrasOcupado: ["reunion", "colegio"],
  ocupadoPorTipo: (tipo) => tipo.requiere_paciente === false || tipo.modalidad === "colegio",
};

export type CriterioAusencias = {
  /** Estados que no cuentan como historia (ni arriba ni abajo de la tasa). */
  estadosFuera: EstadoTurno[];
  /** Qué turno cuenta como "ausencia sin cobro". */
  esSinCobro: (turno: { estado: EstadoTurno; monto_cargo: number }) => boolean;
  /** Cuántos meses calendario, anteriores al mes del reporte, se miran. */
  mesesHistoria: number;
  /** Con menos turnos que esto la tasa es 0: hay poca historia para sacar conclusiones. */
  historiaMinima: number;
};

export const CRITERIO_AUSENCIAS: CriterioAusencias = {
  estadosFuera: ["agendado", "reprogramado"],
  esSinCobro: (turno) => turno.monto_cargo === 0,
  mesesHistoria: 3,
  historiaMinima: 20,
};
