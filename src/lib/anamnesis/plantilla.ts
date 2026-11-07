// Plantillas de anamnesis (tarea A6, docs/expediente.md "Plantilla de anamnesis").
// Estructura: {"secciones":[{"titulo":"…","campos":[{"id":"…","etiqueta":"…","tipo":"…","opciones":["…"]}]}]}
// La plantilla son solo preguntas (no datos de pacientes). Las respuestas de cada paciente
// van en `anamnesis.respuestas` y son DATOS CLÍNICOS (regla de oro 7).
// Funciones puras con tests.

import { z } from "zod";

import type { ErroresFormulario } from "@/lib/config/validacion";

export const TIPOS_CAMPO = ["texto", "largo", "si_no", "opciones", "fecha"] as const;
export type TipoCampo = (typeof TIPOS_CAMPO)[number];

export const NOMBRE_TIPO: Record<TipoCampo, string> = {
  texto: "Texto corto",
  largo: "Texto largo",
  si_no: "Sí / No",
  opciones: "Opciones",
  fecha: "Fecha",
};

export type Campo = { id: string; etiqueta: string; tipo: TipoCampo; opciones?: string[] };
export type Seccion = { titulo: string; campos: Campo[] };
export type Estructura = { secciones: Seccion[] };

export const LIMITES = {
  nombre: 80,
  titulo: 120,
  etiqueta: 200,
  opcion: 80,
  opciones: 20,
  secciones: 30,
  camposPorSeccion: 60,
  id: 50,
} as const;

/** Letra minúscula y después letras, números o "_". */
const FORMATO_ID = /^[a-z][a-z0-9_]*$/;

const esquemaCampo = z
  .object({
    id: z
      .string()
      .max(LIMITES.id, "Identificador demasiado largo.")
      .regex(FORMATO_ID, "Identificador inválido."),
    etiqueta: z
      .string()
      .trim()
      .min(1, "Escribí la pregunta.")
      .max(LIMITES.etiqueta, `La pregunta puede tener hasta ${LIMITES.etiqueta} letras.`),
    tipo: z.enum(TIPOS_CAMPO, "Elegí el tipo de campo."),
    opciones: z
      .array(
        z
          .string()
          .trim()
          .min(1, "Escribí la opción o quitala.")
          .max(LIMITES.opcion, `Cada opción puede tener hasta ${LIMITES.opcion} letras.`),
      )
      .optional(),
  })
  .superRefine((campo, ctx) => {
    if (campo.tipo !== "opciones") return;
    const opciones = campo.opciones ?? [];
    if (opciones.length < 2) ctx.addIssue({ code: "custom", path: ["opciones"], message: "Poné al menos 2 opciones." });
    if (opciones.length > LIMITES.opciones)
      ctx.addIssue({ code: "custom", path: ["opciones"], message: `Hasta ${LIMITES.opciones} opciones.` });
    const vistas = new Set<string>();
    opciones.forEach((o, i) => {
      const clave = o.toLocaleLowerCase("es");
      if (vistas.has(clave)) ctx.addIssue({ code: "custom", path: ["opciones", i], message: "Esta opción está repetida." });
      vistas.add(clave);
    });
  })
  // Solo el tipo "opciones" guarda la lista.
  .transform(({ opciones, ...campo }): Campo => (campo.tipo === "opciones" ? { ...campo, opciones: opciones ?? [] } : campo));

const esquemaSeccion = z.object({
  titulo: z
    .string()
    .trim()
    .min(1, "Escribí el título de la sección.")
    .max(LIMITES.titulo, `El título puede tener hasta ${LIMITES.titulo} letras.`),
  campos: z
    .array(esquemaCampo)
    .min(1, "Agregá al menos un campo a la sección.")
    .max(LIMITES.camposPorSeccion, `Hasta ${LIMITES.camposPorSeccion} campos por sección.`),
});

const esquemaEstructura = z
  .object({
    secciones: z
      .array(esquemaSeccion)
      .min(1, "Agregá al menos una sección.")
      .max(LIMITES.secciones, `Hasta ${LIMITES.secciones} secciones.`),
  })
  .superRefine((estructura, ctx) => {
    // Los ids no se repiten en toda la plantilla (son las claves de las respuestas).
    const vistos = new Set<string>();
    estructura.secciones.forEach((s, i) =>
      s.campos.forEach((c, j) => {
        if (vistos.has(c.id))
          ctx.addIssue({ code: "custom", path: ["secciones", i, "campos", j, "id"], message: "Identificador repetido." });
        vistos.add(c.id);
      }),
    );
  });

/**
 * Lee una estructura guardada en la base (jsonb). Si no tiene el formato esperado devuelve null:
 * la pantalla avisa en vez de romperse.
 */
export function leerEstructura(valor: unknown): Estructura | null {
  const r = esquemaEstructura.safeParse(valor);
  return r.success ? r.data : null;
}

/**
 * Arma un identificador a partir de la pregunta: "¿Tipo de parto?" → "tipo_parto".
 * Si ya está usado agrega _2, _3…
 */
export function idDesdeEtiqueta(etiqueta: string, usados: ReadonlySet<string>): string {
  let base = etiqueta
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40)
    .replace(/_+$/, "");
  if (base === "") base = "campo";
  if (!/^[a-z]/.test(base)) base = `c_${base}`;
  if (!usados.has(base)) return base;
  for (let n = 2; ; n++) {
    const candidato = `${base}_${n}`;
    if (!usados.has(candidato)) return candidato;
  }
}

/**
 * Los campos nuevos llegan con id vacío: se les asigna uno a partir de la pregunta.
 * Los que ya tienen id lo conservan aunque se haya corregido la pregunta.
 */
export function asignarIds<T extends { campos: { id: string; etiqueta: string }[] }>(secciones: T[]): T[] {
  const usados = new Set(secciones.flatMap((s) => s.campos.map((c) => c.id)).filter((id) => id !== ""));
  return secciones.map((s) => ({
    ...s,
    campos: s.campos.map((c) => {
      if (c.id !== "") return c;
      const id = idDesdeEtiqueta(c.etiqueta, usados);
      usados.add(id);
      return { ...c, id };
    }),
  }));
}

/** Mueve el elemento `indice` un lugar hacia arriba (-1) o abajo (+1). Fuera de rango: igual. */
export function mover<T>(lista: readonly T[], indice: number, direccion: -1 | 1): T[] {
  const destino = indice + direccion;
  if (indice < 0 || indice >= lista.length || destino < 0 || destino >= lista.length) return [...lista];
  const copia = [...lista];
  [copia[indice], copia[destino]] = [copia[destino], copia[indice]];
  return copia;
}

const esquemaNombre = z
  .string()
  .trim()
  .min(1, "Escribí el nombre de la plantilla.")
  .max(LIMITES.nombre, `Nombre: hasta ${LIMITES.nombre} letras.`);

export type DatosPlantilla = { nombre: string; estructura: Estructura };

/**
 * Valida lo que manda el editor: `nombre` y `estructura` (JSON en texto).
 * Los errores van por ruta ("secciones.0.campos.1.etiqueta") para mostrarlos al lado de cada campo.
 */
export function validarPlantilla(
  formulario: FormData,
): { ok: true; datos: DatosPlantilla } | { ok: false; errores: ErroresFormulario } {
  const errores: ErroresFormulario = {};
  const nombre = esquemaNombre.safeParse(String(formulario.get("nombre") ?? ""));
  if (!nombre.success) errores.nombre = nombre.error.issues[0]?.message;

  let crudo: unknown;
  try {
    crudo = JSON.parse(String(formulario.get("estructura") ?? ""));
  } catch {
    return { ok: false, errores: { ...errores, general: "No se pudo leer la plantilla. Recargá la página." } };
  }
  const conIds =
    crudo && typeof crudo === "object" && Array.isArray((crudo as { secciones?: unknown }).secciones)
      ? { secciones: asignarIdsSeguro((crudo as { secciones: unknown[] }).secciones) }
      : crudo;

  const estructura = esquemaEstructura.safeParse(conIds);
  if (!estructura.success) {
    for (const problema of estructura.error.issues) {
      const ruta = problema.path.length ? problema.path.join(".") : "estructura";
      errores[ruta] ??= problema.message;
    }
  }
  if (!nombre.success || !estructura.success) return { ok: false, errores };
  return { ok: true, datos: { nombre: nombre.data, estructura: estructura.data } };
}

/** asignarIds sobre datos que todavía no se validaron (lo que no tiene la forma esperada queda igual). */
function asignarIdsSeguro(secciones: unknown[]): unknown[] {
  const bienFormadas = secciones.every(
    (s) =>
      s !== null &&
      typeof s === "object" &&
      Array.isArray((s as { campos?: unknown }).campos) &&
      (s as { campos: unknown[] }).campos.every(
        (c) => c !== null && typeof c === "object" && typeof (c as { id?: unknown }).id === "string",
      ),
  );
  if (!bienFormadas) return secciones;
  const tipadas = (secciones as { campos: { id: string; etiqueta: unknown }[] }[]).map((s) => ({
    ...s,
    campos: s.campos.map((c) => ({ ...c, etiqueta: typeof c.etiqueta === "string" ? c.etiqueta : "" })),
  }));
  return asignarIds(tipadas);
}
