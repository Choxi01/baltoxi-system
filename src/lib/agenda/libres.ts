// Copiar libres (docs/agenda.md, "Copiar libres"): qué horarios libres se ofrecen
// y el texto para mandar por WhatsApp. Funciones puras con tests.
// Solo días y horas: nunca nombres ni datos clínicos (regla de oro 7).

import { aMinutos, horaCorta } from "./bloques";
import { diaYFecha, diasDeLaSemana, finDeMes, inicioDeMes, lunesDe, fechasEntre, sumarDias } from "./calendario";
import type { Dia } from "./turnos";
import { MESES } from "@/lib/pacientes/fecha";

/** Texto de la migración, por si el consultorio no tiene la plantilla. */
export const PLANTILLA_LIBRES_POR_DEFECTO = "Horarios disponibles {rango}:\n{libres}";

/** Un horario es "de mañana" si empieza antes de esta hora; si no, "de tarde". */
export const CORTE_TARDE = "12:00";

export type Franja = "todo" | "manana" | "tarde";
export type Periodo = "dia" | "semana" | "mes";
export type FiltrosLibres = {
  franja: Franja;
  /** No mostrar nada de hoy. */
  desdeManana: boolean;
};
/** Fecha y hora de Asunción del momento en que se copia. */
export type Ahora = { fecha: string; hora: string };
export type LibresDelDia = { fecha: string; horas: string[] };

export function esDeManana(hora: string): boolean {
  return aMinutos(hora) < aMinutos(CORTE_TARDE);
}

function entraEnFranja(hora: string, franja: Franja): boolean {
  if (franja === "manana") return esDeManana(hora);
  if (franja === "tarde") return !esDeManana(hora);
  return true;
}

/**
 * Horas de inicio de los bloques libres de cada día, con los filtros.
 * Lo que ya pasó nunca aparece: ni días anteriores a hoy ni horarios de hoy que ya empezaron.
 */
export function libresPorDia(dias: Dia[], filtros: FiltrosLibres, ahora: Ahora): LibresDelDia[] {
  return dias
    .filter((d) => (filtros.desdeManana ? d.fecha > ahora.fecha : d.fecha >= ahora.fecha))
    .map((d) => ({
      fecha: d.fecha,
      horas: d.filas
        .filter((f) => f.tipo === "bloque" && f.turnos.length === 0)
        .map((f) => f.inicio)
        .filter((h) => d.fecha !== ahora.fecha || aMinutos(h) > aMinutos(ahora.hora))
        .filter((h) => entraEnFranja(h, filtros.franja)),
    }));
}

/** El texto para copiar. Los días sin libres no aparecen. */
export function textoLibres(libres: LibresDelDia[], rango: string, plantilla: string): string {
  const lineas = libres
    .filter((d) => d.horas.length > 0)
    .map((d) => `• ${diaYFecha(d.fecha)}: ${d.horas.map(horaCorta).join(", ")}`);
  if (lineas.length === 0) return `No tengo horarios libres ${rango}`;
  const texto = plantilla.trim() ? plantilla : PLANTILLA_LIBRES_POR_DEFECTO;
  // split/join en vez de replace: así un "$" del texto no se interpreta.
  return texto.split("{rango}").join(rango).split("{libres}").join(lineas.join("\n"));
}

/** Fechas que entran en "hoy", "esta semana" (días visibles) o "este mes" según la fecha que se mira. */
export function fechasDelPeriodo(periodo: Periodo, fecha: string, visibles: number[]): string[] {
  if (periodo === "dia") return [fecha];
  if (periodo === "semana") return diasDeLaSemana(fecha, visibles);
  return fechasEntre(inicioDeMes(fecha), finDeMes(fecha));
}

const diaMes = (fecha: string) => `${Number(fecha.slice(8, 10))}/${Number(fecha.slice(5, 7))}`;

/**
 * El {rango} del mensaje: "hoy", "esta semana", "este mes" si es el período actual;
 * si no, "el lunes 3/11", "la semana del 2 al 6/11", "en diciembre".
 */
export function textoRango(periodo: Periodo, fecha: string, hoy: string, visibles: number[]): string {
  if (periodo === "dia") {
    if (fecha === hoy) return "hoy";
    if (fecha === sumarDias(hoy, 1)) return "mañana";
    return `el ${diaYFecha(fecha).toLowerCase()}`;
  }
  if (periodo === "semana") {
    if (lunesDe(fecha) === lunesDe(hoy)) return "esta semana";
    const fechas = diasDeLaSemana(fecha, visibles);
    const primero = fechas[0];
    const ultimo = fechas.at(-1)!;
    const desde = primero.slice(5, 7) === ultimo.slice(5, 7) ? String(Number(primero.slice(8, 10))) : diaMes(primero);
    return `la semana del ${desde} al ${diaMes(ultimo)}`;
  }
  if (fecha.slice(0, 7) === hoy.slice(0, 7)) return "este mes";
  const mes = MESES[Number(fecha.slice(5, 7)) - 1];
  return fecha.slice(0, 4) === hoy.slice(0, 4) ? `en ${mes}` : `en ${mes} de ${fecha.slice(0, 4)}`;
}
