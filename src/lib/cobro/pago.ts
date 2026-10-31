// Pagos: validar lo que se carga a mano y decidir cuándo mostrar "Cobrar ahora" (docs/reglas-cobro.md §5).
// Funciones puras con tests.

import { z } from "zod";

import { leerGs } from "./formato";
import type { Imputacion } from "./saldo";
import type { EstadoTurno, PlanCobro } from "./tipos";

/** Medios que se ofrecen en la pantalla (la base acepta más; se suman cuando se pidan). */
export const MEDIOS_PAGO = [
  { valor: "efectivo", texto: "Efectivo" },
  { valor: "transferencia", texto: "Transferencia" },
] as const;
export type MedioRegistrable = (typeof MEDIOS_PAGO)[number]["valor"];

export const NOMBRE_MEDIO: Record<string, string> = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  qr: "QR",
  tarjeta: "Tarjeta",
  otro: "Otro",
};

export const REFERENCIA_MAX = 100;

export type DatosPago = {
  tutor_id: string;
  fecha: string;
  monto_gs: number;
  medio: MedioRegistrable;
  referencia: string | null;
};

export type ErroresPago = Partial<Record<"tutor_id" | "fecha" | "monto" | "medio" | "referencia", string>>;

/** ¿"AAAA-MM-DD" es un día que existe? */
function fechaExiste(fecha: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return false;
  const [a, m, d] = fecha.split("-").map(Number);
  const f = new Date(Date.UTC(a, m - 1, d));
  return f.getUTCFullYear() === a && f.getUTCMonth() === m - 1 && f.getUTCDate() === d;
}

const texto = (v: unknown) => (typeof v === "string" ? v : "");

/**
 * Valida un pago cargado a mano. `hoy` = fecha de hoy en Asunción: no se aceptan fechas futuras.
 * El monto se escribe como "290.000" o "290000" y tiene que ser un entero mayor a 0 (regla de oro 1).
 */
export function validarPago(entrada: unknown, hoy: string): { ok: true; datos: DatosPago } | { ok: false; errores: ErroresPago } {
  const e = (typeof entrada === "object" && entrada !== null ? entrada : {}) as Record<string, unknown>;
  const errores: ErroresPago = {};

  const tutorId = texto(e.tutor_id);
  if (!z.uuid().safeParse(tutorId).success) errores.tutor_id = "Elegí quién paga.";

  const fecha = texto(e.fecha);
  if (!fechaExiste(fecha)) errores.fecha = "Poné una fecha válida.";
  else if (fecha > hoy) errores.fecha = "La fecha no puede ser futura.";

  const monto = typeof e.monto === "number" ? e.monto : leerGs(texto(e.monto));
  if (monto == null || !Number.isSafeInteger(monto) || monto <= 0) errores.monto = "Poné un monto en guaraníes, sin decimales (ej. 290.000).";

  const medio = MEDIOS_PAGO.find((m) => m.valor === e.medio)?.valor;
  if (!medio) errores.medio = "Elegí efectivo o transferencia.";

  const referencia = texto(e.referencia).trim();
  if (referencia.length > REFERENCIA_MAX) errores.referencia = `La referencia puede tener hasta ${REFERENCIA_MAX} caracteres.`;

  if (Object.keys(errores).length > 0) return { ok: false, errores };
  return { ok: true, datos: { tutor_id: tutorId, fecha, monto_gs: monto!, medio: medio!, referencia: referencia || null } };
}

/**
 * ¿Va el botón "Cobrar ahora"? Turno con paciente ya marcado, cuyo tipo cobra en el momento
 * o con plan por sesión, y que todavía tenga algo pendiente.
 */
export function puedeCobrarAhora(t: {
  clase: string;
  estado: EstadoTurno;
  cobraEnElMomento: boolean;
  plan: PlanCobro;
  pendiente: number;
}): boolean {
  if (t.clase !== "turno" || t.estado === "agendado") return false;
  if (!t.cobraEnElMomento && t.plan !== "por_sesion") return false;
  return t.pendiente > 0;
}

/**
 * Lo pendiente de un cargo y la deuda de cargos más viejos del mismo tutor (que con FIFO
 * se cubren primero). `imputaciones` = resultado de `imputarPagos` (del más viejo al más nuevo).
 * null si el cargo no está.
 */
export function cobroDelCargo(cargoId: string, imputaciones: Imputacion[]): { pendiente: number; deudaAnterior: number } | null {
  const i = imputaciones.findIndex((f) => f.cargo_id === cargoId);
  if (i < 0) return null;
  const deudaAnterior = imputaciones.slice(0, i).reduce((s, f) => s + f.pendiente, 0);
  return { pendiente: imputaciones[i].pendiente, deudaAnterior };
}
