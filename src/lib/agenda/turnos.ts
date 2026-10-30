// Cruce de bloques con turnos (docs/agenda.md, "Estado de cada bloque").
// Funciones puras con tests.

import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";

import { ZONA } from "@/lib/fechas";
import { aMinutos, bloqueoDelDia, bloquesDelDia, type Bloque, type Bloqueo, type Tramo } from "./bloques";

export const ESTADOS_TURNO = [
  "agendado", "presente", "ausente_con_aviso", "aviso_tardio",
  "ausente_sin_aviso", "cancelado_profesional", "reprogramado",
] as const;
export type EstadoTurno = (typeof ESTADOS_TURNO)[number];
export type ClaseTurno = "turno" | "reservado" | "ocupado";

export const NOMBRE_ESTADO_TURNO: Record<EstadoTurno, string> = {
  agendado: "Agendado",
  presente: "Vino",
  ausente_con_aviso: "Canceló con aviso",
  aviso_tardio: "Canceló tarde",
  ausente_sin_aviso: "No vino",
  cancelado_profesional: "Cancelé yo",
  reprogramado: "Reprogramado",
};

/** Estados que liberan el bloque: el turno queda en el historial, pero el horario vuelve a estar libre. */
const LIBERAN: readonly EstadoTurno[] = ["ausente_con_aviso", "aviso_tardio", "cancelado_profesional", "reprogramado"];

export function liberaBloque(estado: string): boolean {
  return (LIBERAN as readonly string[]).includes(estado);
}

/** Un turno ya pasado a la hora de Asunción. */
export type TurnoAgenda = {
  id: string;
  clase: ClaseTurno;
  estado: EstadoTurno;
  /** "AAAA-MM-DD" en Asunción. */
  fecha: string;
  /** "HH:MM" en Asunción. */
  inicio: string;
  fin: string;
  /** Nombre del paciente, de la reserva o motivo de "ocupado". */
  titulo: string;
  /** Tipo de turno (ej. "Sesión a domicilio"), si tiene. */
  tipo: string | null;
  /** Paciente con ficha (para "Ver expediente"). */
  pacienteId: string | null;
  /** Modalidad del tipo de turno (para el aviso de traslado). Sin tipo = consultorio. */
  modalidad: string | null;
};

/** timestamptz de la base → fecha y hora en Asunción (regla de oro 6). */
export function aHoraLocal(instante: string): { fecha: string; hora: string } {
  const local = new TZDate(new Date(instante), ZONA);
  return { fecha: format(local, "yyyy-MM-dd"), hora: format(local, "HH:mm") };
}

/** "AAAA-MM-DD" (día de Asunción) → instante UTC del comienzo de ese día, para filtrar en la base. */
export function inicioDelDiaUtc(fecha: string): string {
  const [a, m, d] = fecha.split("-").map(Number);
  return new Date(new TZDate(a, m - 1, d, ZONA).getTime()).toISOString();
}

/** Texto del turno como se ve en la agenda. */
export function textoTurno(t: Pick<TurnoAgenda, "clase" | "titulo">): string {
  if (t.clase === "reservado") return `Reservado: ${t.titulo}`;
  if (t.clase === "ocupado") return `Ocupado: ${t.titulo}`;
  return t.titulo;
}

const seSuperponen = (a: { inicio: string; fin: string }, b: { inicio: string; fin: string }) =>
  aMinutos(a.inicio) < aMinutos(b.fin) && aMinutos(b.inicio) < aMinutos(a.fin);

export type FilaDia =
  /** Un bloque del horario: libre si no tiene turnos vivos. `liberados` = cancelados o movidos de ese horario. */
  | { tipo: "bloque"; inicio: string; fin: string; turnos: TurnoAgenda[]; liberados: TurnoAgenda[] }
  /** Un turno vivo que no cae en ningún bloque (fuera de horario o en un feriado). */
  | { tipo: "fuera"; inicio: string; fin: string; turno: TurnoAgenda };

export type Dia = {
  fecha: string;
  /** Feriado o vacaciones de ese día, si hay. */
  bloqueo: Bloqueo | null;
  filas: FilaDia[];
  libres: number;
};

/** Cruza los bloques de un día con sus turnos. */
export function armarDia(
  fecha: string,
  horarios: Tramo[],
  duracion: number,
  bloqueos: Bloqueo[],
  turnos: TurnoAgenda[],
): Dia {
  const bloques: Bloque[] = bloquesDelDia(fecha, horarios, duracion, bloqueos);
  const delDia = turnos.filter((t) => t.fecha === fecha);
  const vivos = delDia.filter((t) => !liberaBloque(t.estado));
  const liberados = delDia.filter((t) => liberaBloque(t.estado));

  const filas: FilaDia[] = bloques.map((b) => ({
    tipo: "bloque",
    inicio: b.inicio,
    fin: b.fin,
    turnos: vivos.filter((t) => seSuperponen(t, b)),
    liberados: liberados.filter((t) => seSuperponen(t, b)),
  }));
  for (const t of vivos) {
    if (!bloques.some((b) => seSuperponen(t, b))) filas.push({ tipo: "fuera", inicio: t.inicio, fin: t.fin, turno: t });
  }
  filas.sort((a, b) => aMinutos(a.inicio) - aMinutos(b.inicio));

  return {
    fecha,
    bloqueo: bloqueoDelDia(fecha, bloqueos),
    filas,
    libres: filas.filter((f) => f.tipo === "bloque" && f.turnos.length === 0).length,
  };
}
