// Ficha online de la familia (tarea A8a, docs/expediente.md "Ficha online para familias").
// Página PÚBLICA: solo datos administrativos. Nunca motivo de consulta, notas, anamnesis,
// documentos, cobros ni turnos (regla de oro 10). Funciones puras con tests.

import { z } from "zod";

import { PARENTESCOS } from "@/lib/tutores/validacion";
import { normalizarTelefono } from "@/lib/tutores/telefono";

type Errores = Partial<Record<string, string>>;
type Resultado<T> = { ok: true; datos: T } | { ok: false; errores: Errores };

/** El token del link es un uuid: cualquier otra cosa ni se busca en la base. */
export function esTokenValido(token: string): boolean {
  return z.uuid().safeParse(token).success;
}

// ---------------------------------------------------------------------------
// Límite de intentos (tabla intentos_publicos)
// ---------------------------------------------------------------------------

/** Ventana de los límites: una hora. */
export const VENTANA_MS = 60 * 60 * 1000;
/** Links con token inválido o inexistente, por IP y por hora: frena a quien prueba links al azar. */
export const MAXIMO_FALLIDOS_POR_IP = 10;
/** Guardados por link y por hora: una familia completa todo de una sin trabarse, pero no puede llenar la base. */
export const MAXIMO_GUARDADOS_POR_LINK = 30;

/** Las claves de intentos_publicos. Van con hash: ni la IP ni el token se guardan tal cual. */
export const claveFallidos = (hashIp: string) => `ficha-fallido:${hashIp}`;
export const claveGuardados = (hashToken: string) => `ficha-guardado:${hashToken}`;

/** `intentos`: cuántos hubo en la última hora (sin contar el actual). */
export function superaLimite(intentos: number, maximo: number): boolean {
  return intentos >= maximo;
}

/** Desde cuándo se cuentan los intentos ("ahora" menos una hora), como ISO. */
export function inicioDeVentana(ahora: Date): string {
  return new Date(ahora.getTime() - VENTANA_MS).toISOString();
}

// ---------------------------------------------------------------------------
// Validaciones de los formularios de la ficha
// ---------------------------------------------------------------------------

const opcional = (maximo: number, campo: string) =>
  z
    .string()
    .trim()
    .max(maximo, `${campo}: hasta ${maximo} letras.`)
    .transform((v) => (v === "" ? null : v));

function esFecha(valor: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor);
  if (!m) return false;
  const [a, mes, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const prueba = new Date(Date.UTC(a, mes - 1, d));
  return prueba.getUTCFullYear() === a && prueba.getUTCMonth() === mes - 1 && prueba.getUTCDate() === d;
}

const esquemaHijo = (hoy: string) =>
  z.object({
    nombre: z.string().trim().min(1, "Escribí el nombre.").max(80, "Nombre: hasta 80 letras."),
    apellido: opcional(80, "Apellido"),
    fecha_nacimiento: z
      .string()
      .transform((v) => (v.trim() === "" ? null : v.trim()))
      .refine((v) => v === null || esFecha(v), "Esa fecha no existe.")
      .refine((v) => v === null || (v >= "1900-01-01" && v <= hoy), "Revisá la fecha de nacimiento."),
    colegio: opcional(120, "Colegio"),
  });

export type DatosHijoFicha = { nombre: string; apellido: string | null; fecha_nacimiento: string | null; colegio: string | null };

/** Lo único que la familia puede cambiar de un hijo. `hoy`: "AAAA-MM-DD" en Asunción. */
export function validarHijoFicha(formulario: FormData, hoy: string): Resultado<DatosHijoFicha> {
  return validar(esquemaHijo(hoy), ["nombre", "apellido", "fecha_nacimiento", "colegio"], formulario);
}

const esquemaOtroTutor = z.object({
  nombre: z.string().trim().min(1, "Escribí el nombre.").max(80, "Nombre: hasta 80 letras."),
  apellido: opcional(80, "Apellido"),
  telefono_wa: z.string().transform((v, ctx) => {
    const numero = normalizarTelefono(v);
    if (numero === "invalido" || numero === null) {
      ctx.addIssue({ code: "custom", message: "Escribí el WhatsApp (ej. 0981 123 456)." });
      return z.NEVER;
    }
    return numero;
  }),
  parentesco: z.enum(PARENTESCOS, "Elegí el parentesco."),
});

export type DatosOtroTutor = { nombre: string; apellido: string | null; telefono_wa: string; parentesco: (typeof PARENTESCOS)[number] };

/** Otro tutor que agrega la familia: nombre, parentesco y WhatsApp (obligatorio). */
export function validarOtroTutor(formulario: FormData): Resultado<DatosOtroTutor> {
  return validar(esquemaOtroTutor, ["nombre", "apellido", "telefono_wa", "parentesco"], formulario);
}

function validar<T>(esquema: z.ZodType<T>, campos: string[], formulario: FormData): Resultado<T> {
  const crudo = Object.fromEntries(campos.map((c) => [c, String(formulario.get(c) ?? "")]));
  const resultado = esquema.safeParse(crudo);
  if (resultado.success) return { ok: true, datos: resultado.data };
  const errores: Errores = {};
  for (const problema of resultado.error.issues) errores[String(problema.path[0] ?? "general")] ??= problema.message;
  return { ok: false, errores };
}
