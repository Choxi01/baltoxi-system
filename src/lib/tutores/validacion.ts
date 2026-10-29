import { z } from "zod";

import { calcularDv } from "./ruc";
import { normalizarTelefono } from "./telefono";

export const PARENTESCOS = ["madre", "padre", "abuela", "abuelo", "tía", "tío", "hermana", "hermano", "tutor legal", "otro"] as const;

const opcional = (maximo: number, campo: string) =>
  z
    .string()
    .trim()
    .max(maximo, `${campo}: hasta ${maximo} letras.`)
    .transform((v) => (v === "" ? null : v));

const esquemaTutor = z
  .object({
    nombre: z.string().trim().min(1, "Escribí el nombre.").max(80, "Nombre: hasta 80 letras."),
    apellido: opcional(80, "Apellido"),
    telefono_wa: z.string().transform((v, ctx) => {
      const numero = normalizarTelefono(v);
      if (numero === "invalido") {
        ctx.addIssue({ code: "custom", message: "Revisá el número (ej. 0981 123 456)." });
        return z.NEVER;
      }
      return numero;
    }),
    email: z
      .string()
      .trim()
      .transform((v) => (v === "" ? null : v.toLowerCase()))
      .pipe(z.email("El email no es válido.").nullable()),
    doc_tipo: z
      .string()
      .transform((v) => (v === "" ? null : v))
      .pipe(z.enum(["RUC", "CI"], "Elegí RUC o CI.").nullable()),
    doc_numero: z
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
    parentesco: z.enum(PARENTESCOS, "Elegí el parentesco."),
  })
  .transform((datos, ctx) => {
    if (datos.doc_tipo && !datos.doc_numero) {
      ctx.addIssue({ code: "custom", path: ["doc_numero"], message: "Escribí el número de documento." });
      return z.NEVER;
    }
    if (!datos.doc_tipo && datos.doc_numero) {
      ctx.addIssue({ code: "custom", path: ["doc_tipo"], message: "Elegí si es RUC o CI." });
      return z.NEVER;
    }
    if (datos.doc_tipo !== "RUC") return { ...datos, dv: null };
    // RUC: el DV se calcula solo. Si lo escribieron, tiene que coincidir.
    const correcto = String(calcularDv(datos.doc_numero ?? ""));
    if (datos.dv && datos.dv !== correcto) {
      ctx.addIssue({ code: "custom", path: ["dv"], message: `El DV no coincide: para ese RUC es ${correcto}.` });
      return z.NEVER;
    }
    return { ...datos, dv: correcto };
  });

export type DatosTutor = z.output<typeof esquemaTutor>;

const CAMPOS = ["nombre", "apellido", "telefono_wa", "email", "doc_tipo", "doc_numero", "dv", "razon_social", "parentesco"] as const;

export function validarTutor(
  formulario: FormData,
): { ok: true; datos: DatosTutor } | { ok: false; errores: Partial<Record<string, string>> } {
  const crudo = Object.fromEntries(CAMPOS.map((c) => [c, String(formulario.get(c) ?? "")]));
  const resultado = esquemaTutor.safeParse(crudo);
  if (resultado.success) return { ok: true, datos: resultado.data };
  const errores: Partial<Record<string, string>> = {};
  for (const problema of resultado.error.issues) errores[String(problema.path[0] ?? "general")] ??= problema.message;
  return { ok: false, errores };
}
