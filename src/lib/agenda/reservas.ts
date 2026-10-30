// Reservar un bloque: avisos (superposición y traslado) y validación de lo que
// se manda al servidor. Funciones puras con tests.

import { TZDate } from "@date-fns/tz";
import { z } from "zod";

import { ZONA } from "@/lib/fechas";
import { aHora, aMinutos } from "./bloques";
import { liberaBloque, textoTurno, type TurnoAgenda } from "./turnos";

/** Lo que se quiere agendar: un día, un horario y (si tiene) la modalidad del tipo de turno. */
export type NuevoTurno = { fecha: string; inicio: string; fin: string; modalidad: string | null };

export type Avisos = {
  /** Turnos vivos que se pisan con el nuevo: hay que confirmar ("¿Agendar igual?"). */
  superpuestos: TurnoAgenda[];
  /** Turnos a menos del tiempo de traslado, cuando alguno es a domicilio: solo un aviso. */
  traslado: TurnoAgenda[];
};

// Online no necesita traslado. Sin tipo de turno = en el consultorio.
const lugar = (modalidad: string | null) => modalidad ?? "consultorio";

/** Minutos entre dos turnos que no se pisan (0 si se tocan o se pisan). */
function separacion(a: { inicio: string; fin: string }, b: { inicio: string; fin: string }): number {
  return Math.max(aMinutos(b.inicio) - aMinutos(a.fin), aMinutos(a.inicio) - aMinutos(b.fin), 0);
}

/**
 * Avisos al agendar (docs/agenda.md): superposición con turnos vivos del mismo
 * día y traslado de menos de `trasladoMin` cuando uno de los dos es a domicilio.
 */
export function avisosAlAgendar(nuevo: NuevoTurno, turnos: TurnoAgenda[], trasladoMin: number): Avisos {
  const vivos = turnos.filter((t) => t.fecha === nuevo.fecha && !liberaBloque(t.estado));
  const pisa = (t: TurnoAgenda) => aMinutos(t.inicio) < aMinutos(nuevo.fin) && aMinutos(nuevo.inicio) < aMinutos(t.fin);
  const superpuestos = vivos.filter(pisa);
  const traslado = vivos.filter((t) => {
    if (pisa(t)) return false;
    const lugares = [lugar(nuevo.modalidad), lugar(t.modalidad)];
    if (lugares.includes("online") || !lugares.includes("domicilio")) return false;
    return separacion(nuevo, t) < trasladoMin;
  });
  return { superpuestos, traslado };
}

/** Textos de los avisos para mostrar antes de guardar. */
export function textosAvisos(avisos: Avisos, trasladoMin: number): { superposicion: string | null; traslado: string | null } {
  const lista = (ts: TurnoAgenda[]) => ts.map((t) => `${textoTurno(t)} (${t.inicio.replace(/^0/, "")})`).join(", ");
  return {
    superposicion: avisos.superpuestos.length
      ? `Ya hay un turno a esta hora: ${lista(avisos.superpuestos)}. ¿Agendar igual?`
      : null,
    traslado: avisos.traslado.length
      ? `Ojo con el traslado: quedan menos de ${trasladoMin} minutos con ${lista(avisos.traslado)}.`
      : null,
  };
}

/** Día y hora de Asunción → instante UTC para guardar en la base (regla de oro 6). */
export function instanteUtc(fecha: string, hora: string): string {
  const [a, m, d] = fecha.split("-").map(Number);
  const minutos = aMinutos(hora);
  return new Date(new TZDate(a, m - 1, d, Math.floor(minutos / 60), minutos % 60, ZONA).getTime()).toISOString();
}

/** Hora de fin: inicio + duración (no pasa de 23:59). */
export function horaFin(inicio: string, duracion: number): string {
  return aHora(Math.min(aMinutos(inicio) + duracion, 23 * 60 + 59));
}

// ---------------------------------------------------------------------
// Validación de lo que manda la pantalla
// ---------------------------------------------------------------------

const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const hora = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const id = z.uuid();

const esquemaReserva = z.discriminatedUnion("clase", [
  z.object({
    clase: z.literal("turno"),
    fecha,
    inicio: hora,
    paciente_id: id,
    tipo_turno_id: id,
    confirmado: z.boolean(),
  }),
  z.object({
    clase: z.literal("reservado"),
    fecha,
    inicio: hora,
    nombre_reserva: z.string().trim().min(1, "Escribí el nombre.").max(80, "Nombre: hasta 80 letras."),
    tipo_turno_id: id.nullable(),
    confirmado: z.boolean(),
  }),
  z.object({
    clase: z.literal("ocupado"),
    fecha,
    inicio: hora,
    motivo_ocupado: z.string().trim().min(1, "Escribí el motivo.").max(80, "Motivo: hasta 80 letras."),
    confirmado: z.boolean(),
  }),
]);

export type DatosReserva = z.infer<typeof esquemaReserva>;

export type ResultadoReserva = { ok: true; datos: DatosReserva } | { ok: false; error: string };

export function validarReserva(entrada: unknown): ResultadoReserva {
  const r = esquemaReserva.safeParse(entrada);
  if (r.success) return { ok: true, datos: r.data };
  const conMensaje = r.error.issues.find((i) => i.code === "custom" || i.code === "too_small" || i.code === "too_big");
  return { ok: false, error: conMensaje?.message ?? "Faltan datos para agendar." };
}

/** "Juan Pérez Gómez" → { nombre: "Juan", apellido: "Pérez Gómez" } (para "Crear ficha" desde una reserva). */
export function partirNombre(completo: string): { nombre: string; apellido: string } {
  const [nombre = "", ...resto] = completo.trim().split(/\s+/);
  return { nombre, apellido: resto.join(" ") };
}
