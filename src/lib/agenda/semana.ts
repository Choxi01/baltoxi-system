// Filas de la vista Semana: una por hora de comienzo y, donde el horario tiene un hueco entre dos
// tramos del mismo día (el almuerzo), una franja gris "no disponible" (docs/agenda.md, "Vistas").
// Funciones puras con tests.

import { aHora, aMinutos, diaSemana, type Tramo } from "./bloques";
import type { Dia } from "./turnos";

/** Un hueco del horario entre dos tramos de un día. Horas "HH:MM". */
export type Corte = { desde: string; hasta: string };

export type FilaSemana =
  | { tipo: "hora"; hora: string }
  /** `fechas`: los días de la semana que tienen ese corte (en los otros, la celda queda vacía). */
  | { tipo: "corte"; desde: string; hasta: string; texto: string; fechas: string[] };

/** Huecos entre los tramos de un día de la semana (0 = domingo), de menor a mayor. */
export function cortesDelDia(dia: number, tramos: Tramo[]): Corte[] {
  const delDia = tramos
    .filter((t) => t.dia_semana === dia)
    .map((t) => ({ desde: aMinutos(t.desde), hasta: aMinutos(t.hasta) }))
    .sort((a, b) => a.desde - b.desde);
  const cortes: Corte[] = [];
  let finHastaAhora = delDia[0]?.hasta ?? 0;
  for (const t of delDia.slice(1)) {
    if (t.desde > finHastaAhora) cortes.push({ desde: aHora(finHastaAhora), hasta: aHora(t.desde) });
    finHastaAhora = Math.max(finHastaAhora, t.hasta);
  }
  return cortes;
}

/** "Almuerzo" si el corte empieza entre las 11:00 y las 15:00; si no, "No disponible". */
export function textoCorte(corte: Corte): string {
  const desde = aMinutos(corte.desde);
  return desde >= 11 * 60 && desde < 15 * 60 ? "Almuerzo" : "No disponible";
}

/**
 * Filas de la grilla de la semana: las horas de comienzo de todos los días (ordenadas) y una fila
 * por cada corte del horario, justo antes de la primera hora que empieza en ese corte o después.
 * Si los días tienen cortes que se pisan (almuerzo a distinta hora), van en una sola fila.
 * Los días con feriado o vacaciones no tienen corte (el día entero está sin agenda).
 */
export function filasSemana(dias: Dia[], tramos: Tramo[]): FilaSemana[] {
  const horas = [...new Set(dias.flatMap((d) => d.filas.map((f) => f.inicio)))].sort();

  // Cortes de cada día, juntando los que se pisan entre días.
  const grupos: { desde: number; hasta: number; fechas: string[] }[] = [];
  for (const d of dias) {
    if (d.bloqueo) continue;
    for (const c of cortesDelDia(diaSemana(d.fecha), tramos)) {
      const desde = aMinutos(c.desde);
      const hasta = aMinutos(c.hasta);
      const grupo = grupos.find((g) => desde < g.hasta && g.desde < hasta);
      if (grupo) {
        grupo.desde = Math.min(grupo.desde, desde);
        grupo.hasta = Math.max(grupo.hasta, hasta);
        if (!grupo.fechas.includes(d.fecha)) grupo.fechas.push(d.fecha);
      } else {
        grupos.push({ desde, hasta, fechas: [d.fecha] });
      }
    }
  }
  grupos.sort((a, b) => a.desde - b.desde);

  const filas: FilaSemana[] = [];
  const pendientes = [...grupos];
  const agregarCorte = () => {
    const g = pendientes.shift()!;
    const corte = { desde: aHora(g.desde), hasta: aHora(g.hasta) };
    filas.push({ tipo: "corte", ...corte, texto: textoCorte(corte), fechas: g.fechas });
  };
  for (const hora of horas) {
    while (pendientes.length > 0 && pendientes[0].desde <= aMinutos(hora)) agregarCorte();
    filas.push({ tipo: "hora", hora });
  }
  // Un corte después de la última hora no dice nada: no se dibuja.
  return horas.length > 0 ? filas : [];
}
