import { z } from "zod";

import { leerGs } from "@/lib/cobro/formato";
import { ESTADOS_PACIENTE } from "./busqueda";
import { armarFecha } from "./fecha";

export const PLANES_COBRO = ["por_sesion", "semanal", "mensual"] as const;
export const NOMBRE_PLAN: Record<(typeof PLANES_COBRO)[number], string> = {
  por_sesion: "Por sesión",
  semanal: "Semanal",
  mensual: "Mensual",
};

// Texto opcional: "" o espacios cuentan como vacío.
const opcional = (maximo: number, campo: string) =>
  z
    .string()
    .trim()
    .max(maximo, `${campo}: hasta ${maximo} letras.`)
    .transform((v) => (v === "" ? null : v));

const idOpcional = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .pipe(z.uuid("Elegí una opción de la lista.").nullable());

/** Datos de la pestaña "Datos" del paciente. `hoy` es "AAAA-MM-DD" en Asunción. */
export function esquemaPaciente(hoy: string) {
  return z.object({
    nombre: z.string().trim().min(1, "Escribí el nombre.").max(80, "Nombre: hasta 80 letras."),
    apellido: opcional(80, "Apellido"),
    fecha_nacimiento: z
      .string()
      .trim()
      .transform((v) => (v === "" ? null : v))
      .refine((v) => v === null || /^\d{4}-\d{2}-\d{2}$/.test(v), "La fecha no es válida.")
      .refine((v) => v === null || v <= hoy, "La fecha de nacimiento no puede ser futura.")
      .refine((v) => v === null || v >= "1900-01-01", "La fecha no es válida."),
    colegio: opcional(120, "Colegio"),
    derivado_por: opcional(120, "Derivado por"),
    motivo_consulta: opcional(2000, "Motivo de consulta"),
    estado: z.enum(ESTADOS_PACIENTE, "Elegí el estado."),
    tarifa_id: idOpcional,
    monto_override_gs: z
      .string()
      .trim()
      .transform((v, ctx) => {
        if (v === "") return null;
        const monto = leerGs(v);
        if (monto === null) {
          ctx.addIssue({ code: "custom", message: "Escribí el precio en guaraníes, sin decimales (ej. 250.000)." });
          return z.NEVER;
        }
        return monto;
      }),
    plan_cobro: z.enum(PLANES_COBRO, "Elegí la forma de pago."),
    responsable_pago_id: idOpcional,
  });
}

export type DatosPaciente = z.output<ReturnType<typeof esquemaPaciente>>;
export type ErroresFormulario = Partial<Record<string, string>>;

const CAMPOS = [
  "nombre", "apellido", "fecha_nacimiento", "colegio", "derivado_por", "motivo_consulta",
  "estado", "tarifa_id", "monto_override_gs", "plan_cobro", "responsable_pago_id",
] as const;

/**
 * Valida lo que viene del formulario. Devuelve los datos limpios o un error por campo.
 * La fecha de nacimiento llega en tres ruedas: fecha_dia, fecha_mes, fecha_anio.
 */
export function validarPaciente(
  formulario: FormData,
  hoy: string,
): { ok: true; datos: DatosPaciente } | { ok: false; errores: ErroresFormulario } {
  const crudo = Object.fromEntries(CAMPOS.map((c) => [c, String(formulario.get(c) ?? "")]));
  const leer = (c: string) => String(formulario.get(c) ?? "");
  const fecha = armarFecha(leer("fecha_dia"), leer("fecha_mes"), leer("fecha_anio"));
  crudo.fecha_nacimiento = fecha.ok ? (fecha.fecha ?? "") : "";

  const resultado = esquemaPaciente(hoy).safeParse(crudo);
  if (resultado.success && fecha.ok) return { ok: true, datos: resultado.data };
  const errores: ErroresFormulario = fecha.ok ? {} : { fecha_nacimiento: fecha.error };
  if (resultado.success) return { ok: false, errores };
  for (const problema of resultado.error.issues) {
    const campo = String(problema.path[0] ?? "general");
    errores[campo] ??= problema.message;
  }
  return { ok: false, errores };
}
