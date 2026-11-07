// Cancelar y reponer turnos (docs/agenda.md y docs/reglas-cobro.md sección 1).
// Funciones puras con tests.
// La clasificación de la cancelación viene del motor de cobro (src/lib/cobro).

import { clasificarCancelacion } from "@/lib/cobro/cancelacion";
import { validarExcepcion } from "./asistencia";
import { liberaBloque } from "./turnos";

export type QuienCancela = "familia" | "profesional";

/** El motivo que queda si se elige "No se cobra" y no se escribe otro. */
export const MOTIVO_AL_CANCELAR = "Excepción al cancelar";

/** "No se cobra" al cancelar tarde (tarea B9). El motivo es opcional. */
export type NoSeCobra = { motivo: string };

const motivoOPorDefecto = (motivo: string) => motivo.trim() || MOTIVO_AL_CANCELAR;

/** Revisa lo que llega de "No se cobra" (la pantalla y el servidor usan la misma regla que Excepción). */
export function validarNoSeCobra(entrada: unknown): { ok: true; datos: NoSeCobra | null } | { ok: false; error: string } {
  if (entrada == null) return { ok: true, datos: null };
  const motivo = (entrada as { motivo?: unknown }).motivo;
  const v = validarExcepcion({ porcentaje: 0, motivo: motivoOPorDefecto(typeof motivo === "string" ? motivo : "") });
  return v.ok ? { ok: true, datos: { motivo: v.datos.motivo } } : v;
}

export type DatosCancelacion = {
  estado: "ausente_con_aviso" | "aviso_tardio" | "cancelado_profesional";
  aviso_en: string | null;
  reponer: boolean;
  /** Solo con "No se cobra": la misma excepción de siempre, en 0%. */
  porcentaje_manual?: number;
  motivo_excepcion?: string;
};

/**
 * Qué se guarda en el turno al cancelar. El cargo lo crea después aplicarEstadoTurno (B3).
 * `noSeCobra` solo vale para un aviso tardío: con aviso a tiempo o "Cancelé yo" se ignora, porque
 * ahí no hay nada que perdonar (y la clasificación que vale es la del servidor).
 */
export function datosCancelacion(
  quien: QuienCancela,
  turno: { inicio: Date },
  avisoEn: Date,
  horasAvisoMinimas: number,
  noSeCobra: NoSeCobra | null = null,
): DatosCancelacion {
  if (quien === "profesional") return { estado: "cancelado_profesional", aviso_en: null, reponer: true };
  const estado = clasificarCancelacion({ inicio: turno.inicio, avisoEn, horasAvisoMinimas });
  const datos: DatosCancelacion = { estado, aviso_en: avisoEn.toISOString(), reponer: false };
  if (estado !== "aviso_tardio" || !noSeCobra) return datos;
  return { ...datos, porcentaje_manual: 0, motivo_excepcion: motivoOPorDefecto(noSeCobra.motivo) };
}

/**
 * Cuánto costaría el aviso tardío: un monto en guaraníes, `null` si no genera cargo (el tipo de
 * turno no cobra) o "desconocido" si no se pudo calcular.
 */
export type MontoAvisoTardio = number | null | "desconocido";

/**
 * ¿Va la pregunta "¿Se cobra?"? Solo si canceló la familia, tarde, y hay algo para cobrar. Si no se
 * sabe el monto, o todavía no llegó (`undefined`), se pregunta igual: mejor preguntar sin el número
 * que cobrar sin preguntar.
 */
export function mostrarSeCobra(
  quien: QuienCancela | null,
  clasificacion: "ausente_con_aviso" | "aviso_tardio",
  monto: MontoAvisoTardio | undefined,
): boolean {
  if (quien !== "familia" || clasificacion !== "aviso_tardio") return false;
  return monto === undefined || monto === "desconocido" || (monto !== null && monto > 0);
}

type ParaReponer = { id: string; reponer: boolean; estado: string };
type Reposicion = { repone_a: string | null; estado: string };

/**
 * Turnos cancelados por la profesional que todavía no tienen reposición.
 * Si la familia cancela la reposición, el turno original vuelve a la lista.
 * Si la reposición la cancela la profesional, la que queda para reponer es la
 * reposición (ya tiene `reponer = true`): el original no vuelve, así la misma
 * sesión no aparece dos veces.
 */
export function pendientesDeReponer<T extends ParaReponer>(cancelados: T[], reposiciones: Reposicion[]): T[] {
  const cuentaComoRepuesto = (estado: string) => !liberaBloque(estado) || estado === "cancelado_profesional";
  const repuestos = new Set(reposiciones.filter((r) => r.repone_a && cuentaComoRepuesto(r.estado)).map((r) => r.repone_a));
  return cancelados.filter((t) => t.reponer && t.estado === "cancelado_profesional" && !repuestos.has(t.id));
}
