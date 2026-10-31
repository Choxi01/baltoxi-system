import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";

// Días, semanas y meses siempre en la zona del consultorio (regla de oro 6).
export const ZONA = "America/Asuncion";

/** La fecha de hoy en Asunción, como "AAAA-MM-DD". */
export function hoyEnAsuncion(ahora: Date = new Date()): string {
  return format(new TZDate(ahora, ZONA), "yyyy-MM-dd");
}

/** Fecha ("AAAA-MM-DD") y hora ("HH:MM") de este momento en Asunción. */
export function ahoraEnAsuncion(ahora: Date = new Date()): { fecha: string; hora: string } {
  const local = new TZDate(ahora, ZONA);
  return { fecha: format(local, "yyyy-MM-dd"), hora: format(local, "HH:mm") };
}
