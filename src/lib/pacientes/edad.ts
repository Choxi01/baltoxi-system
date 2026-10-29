import { differenceInMonths, isValid, parseISO } from "date-fns";

/** Años y meses cumplidos entre la fecha de nacimiento y hoy (fechas "AAAA-MM-DD"). */
export function edad(fechaNacimiento: string, hoy: string): { anios: number; meses: number } | null {
  const nacimiento = parseISO(fechaNacimiento);
  const dia = parseISO(hoy);
  if (!isValid(nacimiento) || !isValid(dia) || nacimiento > dia) return null;
  const totalMeses = differenceInMonths(dia, nacimiento);
  return { anios: Math.floor(totalMeses / 12), meses: totalMeses % 12 };
}

/** "6 años y 3 meses", "1 año", "11 meses", "recién nacido". */
export function textoEdad(fechaNacimiento: string | null, hoy: string): string | null {
  if (!fechaNacimiento) return null;
  const e = edad(fechaNacimiento, hoy);
  if (!e) return null;
  const anios = e.anios === 1 ? "1 año" : `${e.anios} años`;
  const meses = e.meses === 1 ? "1 mes" : `${e.meses} meses`;
  if (e.anios === 0) return e.meses === 0 ? "menos de 1 mes" : meses;
  return e.meses === 0 ? anios : `${anios} y ${meses}`;
}
