// Feriados nacionales de Paraguay (Ley 7544/2025), funciones puras.
// Solo los de ley: los traslados y los feriados extra los decreta el Poder
// Ejecutivo cada año y se cargan a mano en Configuración → Feriados.

import { sumarDias } from "./calendario";

export type FeriadoDelAnio = { desde: string; hasta: string; motivo: string };

const TRASLADABLE = " (puede trasladarse por decreto)";

/** Domingo de Pascua ("AAAA-MM-DD"), calendario gregoriano (algoritmo de Meeus/Jones/Butcher). */
export function domingoDePascua(anio: number): string {
  const a = anio % 19;
  const b = Math.floor(anio / 100);
  const c = anio % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return `${anio}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

/** Los feriados de ley de un año, en su fecha original, ordenados. */
export function feriadosDelAnio(anio: number): FeriadoDelAnio[] {
  const fecha = (mm: string, dd: string) => `${anio}-${mm}-${dd}`;
  const unDia = (desde: string, motivo: string) => ({ desde, hasta: desde, motivo });
  const pascua = domingoDePascua(anio);
  return [
    unDia(fecha("01", "01"), "Año Nuevo"),
    unDia(fecha("03", "01"), "Día de los Héroes" + TRASLADABLE),
    { desde: sumarDias(pascua, -3), hasta: sumarDias(pascua, -2), motivo: "Jueves y Viernes Santo" },
    unDia(fecha("05", "01"), "Día del Trabajador"),
    { desde: fecha("05", "14"), hasta: fecha("05", "15"), motivo: "Independencia Nacional" },
    unDia(fecha("06", "12"), "Paz del Chaco" + TRASLADABLE),
    unDia(fecha("06", "20"), "Jura de la Constitución" + TRASLADABLE),
    unDia(fecha("08", "15"), "Fundación de Asunción"),
    unDia(fecha("09", "29"), "Victoria de Boquerón" + TRASLADABLE),
    unDia(fecha("12", "08"), "Virgen de Caacupé"),
    unDia(fecha("12", "25"), "Navidad"),
  ].sort((x, y) => x.desde.localeCompare(y.desde));
}

/**
 * Años que faltan cargar: el actual y el siguiente, salvo los que ya se
 * cargaron (`cargadosHasta`). Si nunca se cargó nada, empieza por el actual.
 */
export function aniosACargar(hoy: string, cargadosHasta: number | null): number[] {
  const actual = Number(hoy.slice(0, 4));
  return [actual, actual + 1].filter((anio) => cargadosHasta === null || anio > cargadosHasta);
}
