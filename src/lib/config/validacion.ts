import { z } from "zod";

import { COLORES_TIPO } from "@/lib/agenda/colores";
import { CUPO_MAXIMO } from "@/lib/agenda/grupos";
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

// Los 4 valores del check de tipos_turno.modalidad.
export const MODALIDADES = ["consultorio", "domicilio", "online", "colegio"] as const;
export type Modalidad = (typeof MODALIDADES)[number];

export const NOMBRE_MODALIDAD: Record<Modalidad, string> = {
  consultorio: "En el consultorio",
  domicilio: "A domicilio",
  online: "Online",
  colegio: "En el colegio",
};

// Chicos por sesión (migración 0013): 1 individual, 2 doble, 3 o 4 grupal.
export const CUPOS = [1, 2, 3, 4] as const;

/** "Individual", "Doble" o "Grupal de 3"/"Grupal de 4": para el selector y la lista de tipos. */
export function nombreCupo(cupo: number): string {
  if (cupo <= 1) return "Individual";
  if (cupo === 2) return "Doble";
  return `Grupal de ${cupo}`;
}

// Checkbox de un formulario: viene "on" si está marcado y "" si no.
const marcado = z.string().transform((v) => v === "on");

const esquemaTipoTurno = z
  .object({
    nombre: z.string().trim().min(1, "Escribí el nombre del tipo de turno.").max(60, "Nombre: hasta 60 letras."),
    modalidad: z.enum(MODALIDADES, "Elegí dónde se hace."),
    // Color en la agenda (paleta fija, migración 0009).
    color: z.enum(COLORES_TIPO, "Elegí un color."),
    // "" = usa la tarifa del paciente.
    tarifa_id: z
      .string()
      .transform((v) => (v === "" ? null : v))
      .refine((v) => v === null || z.uuid().safeParse(v).success, "Elegí una tarifa de la lista."),
    cobra_en_el_momento: marcado,
    genera_cobro: marcado,
    requiere_paciente: marcado,
    // Chicos por sesión. Sin elegir (formulario viejo) = individual.
    cupo: z
      .string()
      .transform((v) => (v === "" ? 1 : Number(v)))
      .refine((v) => Number.isInteger(v) && v >= 1 && v <= CUPO_MAXIMO, "Elegí cuántos chicos por sesión (1 a 4)."),
  })
  .superRefine((datos, ctx) => {
    if (!datos.requiere_paciente && datos.cupo > 1) {
      ctx.addIssue({ code: "custom", path: ["cupo"], message: "Un tipo sin paciente es de un solo turno: dejalo en 1." });
    }
    if (!datos.requiere_paciente && datos.genera_cobro) {
      ctx.addIssue({ code: "custom", path: ["genera_cobro"], message: "Un tipo sin paciente no puede generar cobro." });
    }
    if (datos.cobra_en_el_momento && !datos.genera_cobro) {
      ctx.addIssue({
        code: "custom",
        path: ["cobra_en_el_momento"],
        message: "Para cobrar en el momento, el tipo tiene que generar cobro.",
      });
    }
  });

export type DatosTipoTurno = z.output<typeof esquemaTipoTurno>;

// Estados con regla de cobro (los del check de reglas_cobro.estado; "agendado" no tiene).
export const ESTADOS_CON_REGLA = [
  "presente", "ausente_con_aviso", "aviso_tardio",
  "ausente_sin_aviso", "cancelado_profesional", "reprogramado",
] as const;
export type EstadoConRegla = (typeof ESTADOS_CON_REGLA)[number];

const porcentaje = entero(0, 100, "Porcentaje entero de 0 a 100.");

const esquemaReglas = z.object(
  Object.fromEntries(ESTADOS_CON_REGLA.map((e) => [e, porcentaje])) as Record<EstadoConRegla, typeof porcentaje>,
);

export type DatosReglas = z.output<typeof esquemaReglas>;

const esquemaExcepcion = z.object({
  paciente_id: z.string().refine((v) => z.uuid().safeParse(v).success, "Elegí un paciente."),
  estado: z.enum(ESTADOS_CON_REGLA, "Elegí un estado."),
  porcentaje,
});

export type DatosExcepcion = z.output<typeof esquemaExcepcion>;

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

export function validarTipoTurno(formulario: FormData) {
  return validar(
    esquemaTipoTurno,
    ["nombre", "modalidad", "color", "tarifa_id", "cobra_en_el_momento", "genera_cobro", "requiere_paciente", "cupo"],
    formulario,
  );
}

export function validarReglas(formulario: FormData) {
  return validar(esquemaReglas, ESTADOS_CON_REGLA, formulario);
}

export const ERROR_EXCEPCION_REPETIDA = "Ese paciente ya tiene una excepción para ese estado.";

/** `existentes`: las excepciones que ya tiene el consultorio, para no repetir paciente + estado. */
export function validarExcepcion(formulario: FormData, existentes: { paciente_id: string; estado: string }[]) {
  const r = validar(esquemaExcepcion, ["paciente_id", "estado", "porcentaje"], formulario);
  if (r.ok && existentes.some((x) => x.paciente_id === r.datos.paciente_id && x.estado === r.datos.estado)) {
    return { ok: false as const, errores: { estado: ERROR_EXCEPCION_REPETIDA } as ErroresFormulario };
  }
  return r;
}
