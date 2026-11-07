// Estructura de las plantillas de anamnesis (tarea A6, docs/expediente.md "Plantilla de anamnesis").
// La plantilla en sí no tiene datos de pacientes, pero lo que se responde con ella es DATO CLÍNICO
// (regla de oro 7). Funciones puras con tests.
//
// Formato guardado en `plantillas_anamnesis.estructura` (y copiado en `anamnesis.estructura`):
// {"secciones":[{"titulo":"...","campos":[{"id":"...","etiqueta":"...","tipo":"texto|largo|si_no|opciones|fecha","opciones":["..."]}]}]}

import { z } from "zod";

export const TIPOS_CAMPO = ["texto", "largo", "si_no", "opciones", "fecha"] as const;
export type TipoCampo = (typeof TIPOS_CAMPO)[number];

export const NOMBRE_TIPO: Record<TipoCampo, string> = {
  texto: "Texto corto",
  largo: "Texto largo",
  si_no: "Sí / No",
  opciones: "Elegir una opción",
  fecha: "Fecha",
};

export type Campo = { id: string; etiqueta: string; tipo: TipoCampo; opciones?: string[] };
export type Seccion = { titulo: string; campos: Campo[] };
export type Estructura = { secciones: Seccion[] };

export const LIMITES = {
  nombre: 100,
  secciones: 40,
  camposPorSeccion: 60,
  camposEnTotal: 400,
  titulo: 150,
  etiqueta: 300,
  opcionesMinimas: 2,
  opcionesMaximas: 30,
  opcion: 100,
  id: 60,
} as const;

/** El `id` de un campo: minúsculas, números y guion bajo, empieza con letra. */
export const FORMATO_ID = /^[a-z][a-z0-9_]*$/;

const esquemaCampo = z
  .object({
    id: z.string().max(LIMITES.id, "Identificador inválido.").regex(FORMATO_ID, "Identificador inválido."),
    etiqueta: z
      .string()
      .trim()
      .min(1, "Escribí la pregunta.")
      .max(LIMITES.etiqueta, `La pregunta puede tener hasta ${LIMITES.etiqueta} letras.`),
    tipo: z.enum(TIPOS_CAMPO, "Elegí el tipo de respuesta."),
    opciones: z.array(z.string().trim()).optional(),
  })
  .superRefine((campo, ctx) => {
    if (campo.tipo !== "opciones") return;
    const opciones = campo.opciones ?? [];
    const problema = (message: string) => ctx.addIssue({ code: "custom", message, path: ["opciones"] });
    if (opciones.length < LIMITES.opcionesMinimas) return problema("Escribí al menos 2 opciones, una por renglón.");
    if (opciones.length > LIMITES.opcionesMaximas) return problema(`Puede haber hasta ${LIMITES.opcionesMaximas} opciones.`);
    if (opciones.some((o) => o.length === 0)) return problema("Hay una opción vacía.");
    if (opciones.some((o) => o.length > LIMITES.opcion)) return problema(`Cada opción puede tener hasta ${LIMITES.opcion} letras.`);
    const vistas = new Set(opciones.map((o) => o.toLocaleLowerCase("es")));
    if (vistas.size !== opciones.length) return problema("Hay opciones repetidas.");
  })
  // Las opciones solo se guardan en los campos de tipo "opciones".
  .transform(({ opciones, ...campo }): Campo => (campo.tipo === "opciones" ? { ...campo, opciones } : campo));

const esquemaSeccion = z.object({
  titulo: z
    .string()
    .trim()
    .min(1, "Escribí el título de la sección.")
    .max(LIMITES.titulo, `El título puede tener hasta ${LIMITES.titulo} letras.`),
  campos: z
    .array(esquemaCampo)
    .min(1, "Agregá al menos una pregunta.")
    .max(LIMITES.camposPorSeccion, `Una sección puede tener hasta ${LIMITES.camposPorSeccion} preguntas.`),
});

export const esquemaEstructura = z
  .object({
    secciones: z
      .array(esquemaSeccion)
      .min(1, "Agregá al menos una sección.")
      .max(LIMITES.secciones, `Puede haber hasta ${LIMITES.secciones} secciones.`),
  })
  .superRefine((estructura, ctx) => {
    const total = estructura.secciones.reduce((suma, s) => suma + s.campos.length, 0);
    if (total > LIMITES.camposEnTotal) {
      ctx.addIssue({ code: "custom", message: `La plantilla puede tener hasta ${LIMITES.camposEnTotal} preguntas.`, path: ["secciones"] });
    }
    // Las respuestas se guardan por `id`: no se puede repetir en toda la plantilla.
    const usados = new Set<string>();
    estructura.secciones.forEach((s, i) =>
      s.campos.forEach((c, j) => {
        if (usados.has(c.id)) {
          ctx.addIssue({ code: "custom", message: "Identificador repetido.", path: ["secciones", i, "campos", j, "id"] });
        }
        usados.add(c.id);
      }),
    );
  });

/**
 * Un problema de la plantilla: `ruta` dice dónde (ej. "secciones.0.campos.2.etiqueta"), `mensaje` lo
 * cuenta con el lugar ("Sección 1, pregunta 3: Escribí la pregunta.") y `detalle` sin el lugar (para
 * mostrarlo al lado del campo).
 */
export type ErrorPlantilla = { ruta: string; mensaje: string; detalle: string };

/** "Sección 1, pregunta 3: " según la ruta del problema. */
export function lugarDelError(ruta: (string | number | symbol)[]): string {
  const [, i, , j] = ruta;
  if (ruta[0] === "nombre") return "Nombre: ";
  if (typeof i !== "number") return "";
  if (typeof j !== "number") return `Sección ${i + 1}: `;
  return `Sección ${i + 1}, pregunta ${j + 1}: `;
}

function aErrores(issues: z.core.$ZodIssue[], prefijo: (string | number)[] = []): ErrorPlantilla[] {
  return issues.map((p) => {
    const ruta = [...prefijo, ...p.path];
    return { ruta: ruta.map(String).join("."), mensaje: `${lugarDelError(ruta)}${p.message}`, detalle: p.message };
  });
}

/** Valida una estructura (de la base o del editor). Nunca confía en lo que llega. */
export function validarEstructura(valor: unknown): { ok: true; estructura: Estructura } | { ok: false; errores: ErrorPlantilla[] } {
  const r = esquemaEstructura.safeParse(valor);
  if (r.success) return { ok: true, estructura: r.data };
  return { ok: false, errores: aErrores(r.error.issues) };
}

const esquemaNombre = z
  .string()
  .trim()
  .min(1, "Escribí el nombre de la plantilla.")
  .max(LIMITES.nombre, `El nombre puede tener hasta ${LIMITES.nombre} letras.`);

export type DatosPlantilla = { nombre: string; estructura: Estructura };

/** Nombre + estructura, como llegan del editor. */
export function validarPlantilla(valor: unknown): { ok: true; datos: DatosPlantilla } | { ok: false; errores: ErrorPlantilla[] } {
  const r = z.object({ nombre: esquemaNombre, estructura: z.unknown() }).safeParse(valor);
  const errores: ErrorPlantilla[] = r.success ? [] : aErrores(r.error.issues);
  const estructura = validarEstructura(r.success ? r.data.estructura : (valor as { estructura?: unknown } | null)?.estructura);
  if (!estructura.ok) errores.push(...estructura.errores.map((e) => ({ ...e, ruta: `estructura.${e.ruta}` })));
  if (!r.success || !estructura.ok) return { ok: false, errores };
  return { ok: true, datos: { nombre: r.data.nombre, estructura: estructura.estructura } };
}

/**
 * Arma un `id` legible a partir de la pregunta ("¿Tipo de parto?" → "tipo_de_parto"), distinto de
 * los `usados` ("tipo_de_parto_2"). Se asigna una sola vez, al crear el campo: si después cambia la
 * pregunta, el `id` queda igual.
 */
export function idParaCampo(etiqueta: string, usados: ReadonlySet<string>): string {
  const base =
    etiqueta
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 40)
      .replace(/_+$/, "") || "campo";
  const conLetra = /^[a-z]/.test(base) ? base : `campo_${base}`;
  if (!usados.has(conLetra)) return conLetra;
  let n = 2;
  while (usados.has(`${conLetra}_${n}`)) n++;
  return `${conLetra}_${n}`;
}

/** Mueve el elemento `indice` un lugar arriba (-1) o abajo (+1). Si no puede, devuelve una copia igual. */
export function mover<T>(lista: readonly T[], indice: number, direccion: -1 | 1): T[] {
  const copia = [...lista];
  const destino = indice + direccion;
  if (indice < 0 || indice >= copia.length || destino < 0 || destino >= copia.length) return copia;
  [copia[indice], copia[destino]] = [copia[destino], copia[indice]];
  return copia;
}

/**
 * Copia independiente de la estructura (para guardarla en `anamnesis.estructura` al crear una
 * anamnesis: si después la plantilla cambia, la del paciente no).
 */
export function copiarEstructura(estructura: Estructura): Estructura {
  return {
    secciones: estructura.secciones.map((s) => ({
      titulo: s.titulo,
      campos: s.campos.map((c) => (c.opciones ? { ...c, opciones: [...c.opciones] } : { ...c })),
    })),
  };
}

/** "3 secciones · 12 preguntas" */
export function resumenEstructura(estructura: Estructura): string {
  const s = estructura.secciones.length;
  const c = estructura.secciones.reduce((suma, x) => suma + x.campos.length, 0);
  return `${s} ${s === 1 ? "sección" : "secciones"} · ${c} ${c === 1 ? "pregunta" : "preguntas"}`;
}
