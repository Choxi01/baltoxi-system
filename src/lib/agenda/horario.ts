import { z } from "zod";

import { armarFecha, textoFecha } from "@/lib/pacientes/fecha";
import { aHora, aMinutos, type Tramo } from "./bloques";

// Horario de atención y feriados: validación y ayudas para la pantalla de
// Configuración. Funciones puras con tests.

/** Días en el orden de la pantalla (lunes primero). `numero` como en la base: 0 = domingo. */
export const DIAS = [
  { numero: 1, nombre: "Lunes" },
  { numero: 2, nombre: "Martes" },
  { numero: 3, nombre: "Miércoles" },
  { numero: 4, nombre: "Jueves" },
  { numero: 5, nombre: "Viernes" },
  { numero: 6, nombre: "Sábado" },
  { numero: 0, nombre: "Domingo" },
] as const;

export function nombreDia(numero: number): string {
  return DIAS.find((d) => d.numero === numero)?.nombre ?? "";
}

/** Ruedas para elegir la hora: de 6 a 22, minutos de 5 en 5. */
export const HORAS = Array.from({ length: 17 }, (_, i) => i + 6);
export const MINUTOS = Array.from({ length: 12 }, (_, i) => i * 5);
/** Duraciones de bloque para elegir: de 15 a 120 minutos, de 5 en 5. */
export const DURACIONES = Array.from({ length: 22 }, (_, i) => 15 + i * 5);

const hora = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Hora no válida");

const esquemaHorario = z.object({
  duracion: z.number().int().min(15).max(120),
  tramos: z
    .array(z.object({ dia_semana: z.number().int().min(0).max(6), desde: hora, hasta: hora }))
    .max(70),
});

export type DatosHorario = z.infer<typeof esquemaHorario>;

export type ResultadoHorario =
  | { ok: true; datos: DatosHorario }
  | { ok: false; general?: string; porDia: Partial<Record<number, string>> };

/**
 * Valida el horario completo: en cada tramo "hasta" tiene que ser mayor que
 * "desde", y en un mismo día los tramos no se pueden pisar (pegados sí: 11:00–12:00 y 12:00–13:00).
 */
export function validarHorario(entrada: unknown): ResultadoHorario {
  const r = esquemaHorario.safeParse(entrada);
  if (!r.success) return { ok: false, general: "El horario no es válido.", porDia: {} };

  const porDia: Partial<Record<number, string>> = {};
  for (const { numero, nombre } of DIAS) {
    const delDia = r.data.tramos
      .filter((t) => t.dia_semana === numero)
      .sort((a, b) => aMinutos(a.desde) - aMinutos(b.desde));
    const alReves = delDia.find((t) => aMinutos(t.hasta) <= aMinutos(t.desde));
    if (alReves) {
      porDia[numero] = `${nombre}: en ${alReves.desde}–${alReves.hasta}, "hasta" tiene que ser después de "desde".`;
      continue;
    }
    const pisado = delDia.findIndex((t, i) => i > 0 && aMinutos(t.desde) < aMinutos(delDia[i - 1].hasta));
    if (pisado > 0) {
      const [a, b] = [delDia[pisado - 1], delDia[pisado]];
      porDia[numero] = `${nombre}: los tramos ${a.desde}–${a.hasta} y ${b.desde}–${b.hasta} se pisan.`;
    }
  }
  if (Object.keys(porDia).length > 0) return { ok: false, porDia };
  return { ok: true, datos: r.data };
}

/** Copia los tramos de un día a otros (reemplaza lo que tenían esos días). */
export function copiarDia<T extends Tramo>(tramos: T[], origen: number, destinos: number[], crear: (t: Tramo) => T): T[] {
  const otros = destinos.filter((d) => d !== origen);
  const delOrigen = tramos.filter((t) => t.dia_semana === origen);
  return [
    ...tramos.filter((t) => !otros.includes(t.dia_semana)),
    ...otros.flatMap((dia) => delOrigen.map((t) => crear({ dia_semana: dia, desde: t.desde, hasta: t.hasta }))),
  ];
}

/** Hora de la base ("09:00:00") a la de la pantalla ("09:00"). */
export function horaDeBase(valor: string): string {
  return aHora(aMinutos(valor));
}

// ---------------------------------------------------------------------
// Feriados y vacaciones
// ---------------------------------------------------------------------

export type ErroresBloqueo = Partial<Record<"desde" | "hasta" | "motivo" | "general", string>>;

export type ResultadoBloqueo =
  | { ok: true; datos: { desde: string; hasta: string; motivo: string | null } }
  | { ok: false; errores: ErroresBloqueo };

/**
 * Valida un feriado o vacaciones desde las ruedas del formulario
 * (desde_dia, desde_mes, desde_anio, hasta_..., motivo). Sin "hasta" = un solo día.
 */
export function validarBloqueo(campos: Record<string, string | undefined>): ResultadoBloqueo {
  const leer = (c: string) => (campos[c] ?? "").trim();
  const errores: ErroresBloqueo = {};

  const desde = armarFecha(leer("desde_dia"), leer("desde_mes"), leer("desde_anio"));
  if (!desde.ok) errores.desde = desde.error;
  else if (!desde.fecha) errores.desde = "Elegí la fecha.";

  const hasta = armarFecha(leer("hasta_dia"), leer("hasta_mes"), leer("hasta_anio"));
  if (!hasta.ok) errores.hasta = hasta.error;

  const motivo = leer("motivo");
  if (motivo.length > 100) errores.motivo = "Máximo 100 letras.";

  if (Object.keys(errores).length > 0 || !desde.ok || !desde.fecha || !hasta.ok) return { ok: false, errores };
  const fin = hasta.fecha ?? desde.fecha;
  if (fin < desde.fecha) return { ok: false, errores: { hasta: "Tiene que ser el mismo día o después de “desde”." } };
  return { ok: true, datos: { desde: desde.fecha, hasta: fin, motivo: motivo || null } };
}

/** "8 de diciembre de 2026" o "del 21 de diciembre de 2026 al 8 de enero de 2027". */
export function textoBloqueo(b: { desde: string; hasta: string }): string {
  if (b.desde === b.hasta) return textoFecha(b.desde) ?? b.desde;
  return `Del ${textoFecha(b.desde)} al ${textoFecha(b.hasta)}`;
}

/** Feriados y vacaciones que todavía no terminaron, del más cercano al más lejano. */
export function proximosBloqueos<T extends { desde: string; hasta: string }>(bloqueos: T[], hoy: string): T[] {
  return bloqueos.filter((b) => b.hasta >= hoy).sort((a, b) => a.desde.localeCompare(b.desde));
}
