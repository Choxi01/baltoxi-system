// Borrador del editor de plantillas de anamnesis (Configuración > Anamnesis, tarea A6).
// Lo que se está editando en pantalla, con operaciones puras (agregar, cambiar, quitar, subir, bajar).
// Cada sección y campo lleva una `clave` solo para la pantalla; los campos nuevos no tienen `id`
// hasta guardar (se arma con la pregunta, ver `idParaCampo`).

import { idParaCampo, mover, type Estructura, type TipoCampo } from "./estructura";

export type CampoBorrador = {
  clave: string;
  /** null: campo nuevo; el `id` se arma al guardar. */
  id: string | null;
  etiqueta: string;
  tipo: TipoCampo;
  /** Una opción por renglón. Se conserva aunque se cambie el tipo, por si se vuelve a "opciones". */
  opcionesTexto: string;
};
export type SeccionBorrador = { clave: string; titulo: string; campos: CampoBorrador[] };
export type Borrador = { nombre: string; secciones: SeccionBorrador[] };

/** Las `clave` las da quien llama (en pantalla, `crypto.randomUUID`), para que esto sea puro. */
export type NuevaClave = () => string;

export function aBorrador(nombre: string, estructura: Estructura, clave: NuevaClave): Borrador {
  return {
    nombre,
    secciones: estructura.secciones.map((s) => ({
      clave: clave(),
      titulo: s.titulo,
      campos: s.campos.map((c) => ({
        clave: clave(),
        id: c.id,
        etiqueta: c.etiqueta,
        tipo: c.tipo,
        opcionesTexto: (c.opciones ?? []).join("\n"),
      })),
    })),
  };
}

export function borradorVacio(clave: NuevaClave): Borrador {
  return { nombre: "", secciones: [seccionNueva(clave)] };
}

const campoNuevo = (clave: NuevaClave): CampoBorrador => ({ clave: clave(), id: null, etiqueta: "", tipo: "texto", opcionesTexto: "" });
const seccionNueva = (clave: NuevaClave): SeccionBorrador => ({ clave: clave(), titulo: "", campos: [campoNuevo(clave)] });

/** Renglones no vacíos, sin espacios de más. */
export function opcionesDesdeTexto(texto: string): string[] {
  return texto
    .split(/\r?\n/)
    .map((o) => o.trim())
    .filter((o) => o.length > 0);
}

/**
 * El borrador en el formato que se guarda. Los campos nuevos reciben su `id` a partir de la pregunta,
 * sin repetir los que ya existen. El resultado se valida aparte (`validarPlantilla`).
 */
export function desdeBorrador(borrador: Borrador): { nombre: string; estructura: Estructura } {
  const usados = new Set(borrador.secciones.flatMap((s) => s.campos.flatMap((c) => (c.id ? [c.id] : []))));
  return {
    nombre: borrador.nombre,
    estructura: {
      secciones: borrador.secciones.map((s) => ({
        titulo: s.titulo,
        campos: s.campos.map((c) => {
          let id = c.id;
          if (!id) {
            id = idParaCampo(c.etiqueta, usados);
            usados.add(id);
          }
          const campo = { id, etiqueta: c.etiqueta, tipo: c.tipo };
          return c.tipo === "opciones" ? { ...campo, opciones: opcionesDesdeTexto(c.opcionesTexto) } : campo;
        }),
      })),
    },
  };
}

// --- Operaciones del editor (devuelven un borrador nuevo; nunca cambian el anterior) -------------

const conSecciones = (b: Borrador, secciones: SeccionBorrador[]): Borrador => ({ ...b, secciones });

function cambiarSeccionEn(b: Borrador, i: number, cambio: (s: SeccionBorrador) => SeccionBorrador): Borrador {
  return conSecciones(b, b.secciones.map((s, k) => (k === i ? cambio(s) : s)));
}

export const cambiarNombre = (b: Borrador, nombre: string): Borrador => ({ ...b, nombre });

export const agregarSeccion = (b: Borrador, clave: NuevaClave): Borrador => conSecciones(b, [...b.secciones, seccionNueva(clave)]);

export const quitarSeccion = (b: Borrador, i: number): Borrador => conSecciones(b, b.secciones.filter((_, k) => k !== i));

export const moverSeccion = (b: Borrador, i: number, direccion: -1 | 1): Borrador => conSecciones(b, mover(b.secciones, i, direccion));

export const cambiarTitulo = (b: Borrador, i: number, titulo: string): Borrador => cambiarSeccionEn(b, i, (s) => ({ ...s, titulo }));

export const agregarCampo = (b: Borrador, i: number, clave: NuevaClave): Borrador =>
  cambiarSeccionEn(b, i, (s) => ({ ...s, campos: [...s.campos, campoNuevo(clave)] }));

export const quitarCampo = (b: Borrador, i: number, j: number): Borrador =>
  cambiarSeccionEn(b, i, (s) => ({ ...s, campos: s.campos.filter((_, k) => k !== j) }));

export const moverCampo = (b: Borrador, i: number, j: number, direccion: -1 | 1): Borrador =>
  cambiarSeccionEn(b, i, (s) => ({ ...s, campos: mover(s.campos, j, direccion) }));

export const cambiarCampo = (
  b: Borrador,
  i: number,
  j: number,
  cambio: Partial<Pick<CampoBorrador, "etiqueta" | "tipo" | "opcionesTexto">>,
): Borrador => cambiarSeccionEn(b, i, (s) => ({ ...s, campos: s.campos.map((c, k) => (k === j ? { ...c, ...cambio } : c)) }));

/** Para avisar antes de salir sin guardar. */
export function hayCambios(original: Borrador, actual: Borrador): boolean {
  return JSON.stringify(desdeBorrador(original)) !== JSON.stringify(desdeBorrador(actual));
}
