import { z } from "zod";

import { leerGs } from "@/lib/cobro/formato";
import { calcularDv } from "@/lib/tutores/ruc";

export type ErroresFormulario = Partial<Record<string, string>>;

// Texto opcional: "" o espacios cuentan como vacío.
const opcional = (maximo: number, campo: string) =>
  z
    .string()
    .trim()
    .max(maximo, `${campo}: hasta ${maximo} letras.`)
    .transform((v) => (v === "" ? null : v));

const entero = (minimo: number, maximo: number, mensaje: string) =>
  z
    .string()
    .trim()
    .refine((v) => /^\d+$/.test(v) && Number(v) >= minimo && Number(v) <= maximo, mensaje)
    .transform(Number);

const esquemaConsultorio = z
  .object({
    nombre: z.string().trim().min(1, "Escribí el nombre del consultorio.").max(80, "Nombre: hasta 80 letras."),
    profesional: opcional(120, "Profesional"),
    ruc: z
      .string()
      .transform((v) => v.replace(/[.\s]/g, ""))
      .transform((v) => (v === "" ? null : v))
      .refine((v) => v === null || /^\d{1,9}$/.test(v), "Solo números (sin el DV)."),
    dv: z
      .string()
      .trim()
      .transform((v) => (v === "" ? null : v))
      .refine((v) => v === null || /^\d$/.test(v), "El DV es un solo número."),
    razon_social: opcional(120, "Razón social"),
    direccion: opcional(200, "Dirección"),
    datos_pago: opcional(300, "Datos de pago"),
    horas_aviso_minimas: entero(0, 720, "Escribí las horas en números enteros (ej. 48)."),
    dia_limite_pago: entero(1, 28, "Elegí un día entre 1 y 28."),
    concepto_factura: z.string().trim().min(1, "Escribí el concepto de la factura.").max(120, "Concepto: hasta 120 letras."),
  })
  .transform((datos, ctx) => {
    if (!datos.ruc) return { ...datos, dv: null };
    // El DV se calcula solo. Si lo escribieron, tiene que coincidir.
    const correcto = String(calcularDv(datos.ruc));
    if (datos.dv && datos.dv !== correcto) {
      ctx.addIssue({ code: "custom", path: ["dv"], message: `El DV no coincide: para ese RUC es ${correcto}.` });
      return z.NEVER;
    }
    return { ...datos, dv: correcto };
  });

export type DatosConsultorio = z.output<typeof esquemaConsultorio>;

const esquemaTarifa = z.object({
  nombre: z.string().trim().min(1, "Escribí el nombre de la tarifa.").max(60, "Nombre: hasta 60 letras."),
  monto_gs: z.string().transform((v, ctx) => {
    const monto = leerGs(v.trim());
    if (monto === null) {
      ctx.addIssue({ code: "custom", message: "Escribí el monto en guaraníes, sin decimales (ej. 290.000)." });
      return z.NEVER;
    }
    return monto;
  }),
});

export type DatosTarifa = z.output<typeof esquemaTarifa>;

const CAMPOS_CONSULTORIO = [
  "nombre", "profesional", "ruc", "dv", "razon_social", "direccion", "datos_pago",
  "horas_aviso_minimas", "dia_limite_pago", "concepto_factura",
] as const;

function validar<T>(esquema: z.ZodType<T>, campos: readonly string[], formulario: FormData) {
  const crudo = Object.fromEntries(campos.map((c) => [c, String(formulario.get(c) ?? "")]));
  const resultado = esquema.safeParse(crudo);
  if (resultado.success) return { ok: true as const, datos: resultado.data };
  const errores: ErroresFormulario = {};
  for (const problema of resultado.error.issues) errores[String(problema.path[0] ?? "general")] ??= problema.message;
  return { ok: false as const, errores };
}

export function validarConsultorio(formulario: FormData) {
  return validar(esquemaConsultorio, CAMPOS_CONSULTORIO, formulario);
}

export function validarTarifa(formulario: FormData) {
  return validar(esquemaTarifa, ["nombre", "monto_gs"], formulario);
}
