// Fechas de la agenda como texto "AAAA-MM-DD": sumar días, semanas y meses,
// y armar la grilla del mes. Funciones puras: sin zona horaria del navegador.

import { MESES } from "@/lib/pacientes/fecha";
import { diaSemana } from "./bloques";

export type Vista = "dia" | "semana" | "mes";

const DIAS_CORTOS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"] as const;
const DIAS_LARGOS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"] as const;

function aFecha(a: number, m: number, d: number): string {
  const f = new Date(Date.UTC(a, m - 1, d));
  return f.toISOString().slice(0, 10);
}

function partes(fecha: string): [number, number, number] {
  const [a, m, d] = fecha.split("-").map(Number);
  return [a, m, d];
}

export function sumarDias(fecha: string, dias: number): string {
  const [a, m, d] = partes(fecha);
  return aFecha(a, m, d + dias);
}

/** Primer día del mes, `meses` meses después (o antes, si es negativo). */
export function inicioDeMes(fecha: string, meses = 0): string {
  const [a, m] = partes(fecha);
  return aFecha(a, m + meses, 1);
}

export function finDeMes(fecha: string): string {
  const [a, m] = partes(fecha);
  return aFecha(a, m + 1, 0);
}

/** Lunes de la semana de esa fecha. */
export function lunesDe(fecha: string): string {
  return sumarDias(fecha, -((diaSemana(fecha) + 6) % 7));
}

/** Las fechas de `desde` a `hasta`, las dos incluidas. */
export function fechasEntre(desde: string, hasta: string): string[] {
  const fechas: string[] = [];
  for (let f = desde; f <= hasta; f = sumarDias(f, 1)) fechas.push(f);
  return fechas;
}

/**
 * Días de la semana que se muestran (0 = domingo), de lunes en adelante:
 * lunes a viernes siempre, y sábado o domingo solo si tienen horario.
 */
export function diasVisibles(diasConHorario: number[]): number[] {
  return [1, 2, 3, 4, 5, 6, 0].filter((d) => (d >= 1 && d <= 5) || diasConHorario.includes(d));
}

/** Fechas de la semana de `fecha` que se muestran. */
export function diasDeLaSemana(fecha: string, visibles: number[]): string[] {
  const lunes = lunesDe(fecha);
  return fechasEntre(lunes, sumarDias(lunes, 6)).filter((f) => visibles.includes(diaSemana(f)));
}

/** Semanas del mes (de lunes a domingo) que cubren todo el mes. */
export function semanasDelMes(fecha: string): string[][] {
  const fin = finDeMes(fecha);
  const semanas: string[][] = [];
  for (let lunes = lunesDe(inicioDeMes(fecha)); lunes <= fin; lunes = sumarDias(lunes, 7)) {
    semanas.push(fechasEntre(lunes, sumarDias(lunes, 6)));
  }
  return semanas;
}

/** Fechas que necesita una vista (de la primera a la última). */
export function rangoDeVista(vista: Vista, fecha: string): { desde: string; hasta: string } {
  if (vista === "dia") return { desde: fecha, hasta: fecha };
  if (vista === "semana") return { desde: lunesDe(fecha), hasta: sumarDias(lunesDe(fecha), 6) };
  const semanas = semanasDelMes(fecha);
  return { desde: semanas[0][0], hasta: semanas.at(-1)![6] };
}

/**
 * Qué se trae de la base para una fecha: del mes anterior al siguiente (con las
 * semanas completas). Así moverse por días, semanas o un mes es instantáneo.
 */
export function rangoParaCargar(fecha: string): { desde: string; hasta: string } {
  return {
    desde: rangoDeVista("mes", inicioDeMes(fecha, -1)).desde,
    hasta: rangoDeVista("mes", inicioDeMes(fecha, 1)).hasta,
  };
}

export function cubre(rango: { desde: string; hasta: string }, vista: Vista, fecha: string): boolean {
  const necesita = rangoDeVista(vista, fecha);
  return rango.desde <= necesita.desde && necesita.hasta <= rango.hasta;
}

/** Fecha después de tocar ← (-1) o → (+1) en una vista. */
export function mover(vista: Vista, fecha: string, paso: 1 | -1): string {
  if (vista === "dia") return sumarDias(fecha, paso);
  if (vista === "semana") return sumarDias(fecha, 7 * paso);
  return inicioDeMes(fecha, paso);
}

/** Títulos: "Lunes 2 de noviembre", "2 al 6 de noviembre", "Noviembre 2026". */
export function tituloDia(fecha: string): string {
  const [, m, d] = partes(fecha);
  return `${DIAS_LARGOS[diaSemana(fecha)]} ${d} de ${MESES[m - 1]}`;
}

export function tituloSemana(fechas: string[]): string {
  if (fechas.length === 0) return "";
  const [, m1, d1] = partes(fechas[0]);
  const [, m2, d2] = partes(fechas.at(-1)!);
  return m1 === m2 ? `${d1} al ${d2} de ${MESES[m2 - 1]}` : `${d1} de ${MESES[m1 - 1]} al ${d2} de ${MESES[m2 - 1]}`;
}

export function tituloMes(fecha: string): string {
  const [a, m] = partes(fecha);
  const mes = MESES[m - 1];
  return `${mes[0].toUpperCase()}${mes.slice(1)} ${a}`;
}

/** "lun 2" para encabezados de columnas. */
export function diaCorto(fecha: string): string {
  return `${DIAS_CORTOS[diaSemana(fecha)]} ${partes(fecha)[2]}`;
}

export function numeroDia(fecha: string): number {
  return partes(fecha)[2];
}

export function nombreCortoDia(numero: number): string {
  return DIAS_CORTOS[numero];
}

/** "Lunes 3/11": como se escribe un día en los mensajes. */
export function diaYFecha(fecha: string): string {
  const [, m, d] = partes(fecha);
  return `${DIAS_LARGOS[diaSemana(fecha)]} ${d}/${m}`;
}
