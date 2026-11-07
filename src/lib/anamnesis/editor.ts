// Estado del editor de plantillas de anamnesis (Configuración > Anamnesis, tarea A6).
// Lo que se edita en pantalla antes de tocar "Guardar plantilla". Funciones puras con tests.

import { mover, type Estructura, type TipoCampo } from "./plantilla";

/** `clave`: solo para la pantalla (React). `id`: vacío en los campos nuevos; se arma al guardar. */
export type CampoEditor = { clave: string; id: string; etiqueta: string; tipo: TipoCampo; opciones: string[] };
export type SeccionEditor = { clave: string; titulo: string; campos: CampoEditor[] };

type NuevaClave = () => string;

export function campoNuevo(clave: NuevaClave): CampoEditor {
  return { clave: clave(), id: "", etiqueta: "", tipo: "texto", opciones: ["", ""] };
}

export function seccionNueva(clave: NuevaClave): SeccionEditor {
  return { clave: clave(), titulo: "", campos: [campoNuevo(clave)] };
}

/** Plantilla guardada → editor. Sin plantilla: una sección con un campo para empezar. */
export function aEditor(estructura: Estructura | null, clave: NuevaClave): SeccionEditor[] {
  if (!estructura) return [seccionNueva(clave)];
  return estructura.secciones.map((s) => ({
    clave: clave(),
    titulo: s.titulo,
    campos: s.campos.map((c) => ({
      clave: clave(),
      id: c.id,
      etiqueta: c.etiqueta,
      tipo: c.tipo,
      opciones: c.opciones?.length ? [...c.opciones] : ["", ""],
    })),
  }));
}

/**
 * Editor → lo que se manda al servidor. Las opciones solo viajan en los campos de tipo "opciones"
 * (en pantalla se conservan aunque se cambie el tipo, por si se vuelve atrás).
 */
export function aEstructura(secciones: SeccionEditor[]) {
  return {
    secciones: secciones.map((s) => ({
      titulo: s.titulo,
      campos: s.campos.map((c) =>
        c.tipo === "opciones"
          ? { id: c.id, etiqueta: c.etiqueta, tipo: c.tipo, opciones: c.opciones }
          : { id: c.id, etiqueta: c.etiqueta, tipo: c.tipo },
      ),
    })),
  };
}

// --- Cambios sobre el editor (devuelven una copia) ---

export function moverSeccion(secciones: SeccionEditor[], i: number, direccion: -1 | 1): SeccionEditor[] {
  return mover(secciones, i, direccion);
}

export function cambiarSeccion(secciones: SeccionEditor[], i: number, cambio: Partial<Pick<SeccionEditor, "titulo">>) {
  return secciones.map((s, k) => (k === i ? { ...s, ...cambio } : s));
}

export function quitarSeccion(secciones: SeccionEditor[], i: number): SeccionEditor[] {
  return secciones.filter((_, k) => k !== i);
}

function enSeccion(secciones: SeccionEditor[], i: number, cambio: (campos: CampoEditor[]) => CampoEditor[]) {
  return secciones.map((s, k) => (k === i ? { ...s, campos: cambio(s.campos) } : s));
}

export function agregarCampo(secciones: SeccionEditor[], i: number, clave: NuevaClave): SeccionEditor[] {
  return enSeccion(secciones, i, (campos) => [...campos, campoNuevo(clave)]);
}

export function moverCampo(secciones: SeccionEditor[], i: number, j: number, direccion: -1 | 1): SeccionEditor[] {
  return enSeccion(secciones, i, (campos) => mover(campos, j, direccion));
}

export function cambiarCampo(
  secciones: SeccionEditor[],
  i: number,
  j: number,
  cambio: Partial<Pick<CampoEditor, "etiqueta" | "tipo" | "opciones">>,
): SeccionEditor[] {
  return enSeccion(secciones, i, (campos) => campos.map((c, k) => (k === j ? { ...c, ...cambio } : c)));
}

export function quitarCampo(secciones: SeccionEditor[], i: number, j: number): SeccionEditor[] {
  return enSeccion(secciones, i, (campos) => campos.filter((_, k) => k !== j));
}

/** Total de campos (para mostrar "3 secciones · 12 campos"). */
export function contarCampos(estructura: Estructura): number {
  return estructura.secciones.reduce((total, s) => total + s.campos.length, 0);
}
