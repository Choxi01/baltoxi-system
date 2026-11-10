import { describe, expect, it } from "vitest";
import {
  LIMITES,
  copiarEstructura,
  idParaCampo,
  mover,
  resumenEstructura,
  validarEstructura,
  validarPlantilla,
  type Estructura,
} from "./estructura";

// Plantilla inventada (como la de docs/expediente.md).
const ejemplo = (): Estructura => ({
  secciones: [
    {
      titulo: "Datos del embarazo y parto",
      campos: [
        { id: "embarazo", etiqueta: "¿Cómo fue el embarazo?", tipo: "largo" },
        { id: "parto_tipo", etiqueta: "Tipo de parto", tipo: "opciones", opciones: ["Natural", "Cesárea"] },
        { id: "semanas", etiqueta: "Semanas de gestación", tipo: "texto" },
      ],
    },
    {
      titulo: "Desarrollo",
      campos: [
        { id: "camino", etiqueta: "¿Caminó antes del año?", tipo: "si_no" },
        { id: "control", etiqueta: "Último control", tipo: "fecha" },
      ],
    },
  ],
});

const mensajes = (r: ReturnType<typeof validarEstructura>) => (r.ok ? [] : r.errores.map((e) => e.mensaje));

describe("validarEstructura", () => {
  it("acepta la plantilla de ejemplo con los 5 tipos", () => {
    const r = validarEstructura(ejemplo());
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.estructura).toEqual(ejemplo());
  });

  it("saca espacios de más y las opciones de campos que no son de opciones", () => {
    const e = ejemplo();
    e.secciones[0].titulo = "  Embarazo  ";
    e.secciones[0].campos[0] = { id: "embarazo", etiqueta: " ¿Cómo fue? ", tipo: "largo", opciones: ["sobra"] };
    e.secciones[0].campos[1].opciones = [" Natural ", "Cesárea"];
    const r = validarEstructura(e);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.estructura.secciones[0].titulo).toBe("Embarazo");
    expect(r.estructura.secciones[0].campos[0]).toEqual({ id: "embarazo", etiqueta: "¿Cómo fue?", tipo: "largo" });
    expect(r.estructura.secciones[0].campos[1].opciones).toEqual(["Natural", "Cesárea"]);
  });

  it("ignora claves que no conoce", () => {
    const r = validarEstructura({ ...ejemplo(), extra: "x" });
    expect(r.ok && "extra" in r.estructura).toBe(false);
  });

  it("rechaza lo que no es una estructura", () => {
    for (const valor of [null, "texto", 3, [], {}, { secciones: "x" }]) expect(validarEstructura(valor).ok).toBe(false);
  });

  it("pide al menos una sección y una pregunta por sección", () => {
    expect(mensajes(validarEstructura({ secciones: [] }))).toEqual(["Agregá al menos una sección."]);
    expect(mensajes(validarEstructura({ secciones: [{ titulo: "Vacía", campos: [] }] }))).toEqual([
      "Sección 1: Agregá al menos una pregunta.",
    ]);
  });

  it("dice dónde está cada problema", () => {
    const e = ejemplo();
    e.secciones[1].titulo = " ";
    e.secciones[1].campos[1].etiqueta = "";
    const r = validarEstructura(e);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errores).toEqual([
      { ruta: "secciones.1.titulo", mensaje: "Sección 2: Escribí el título de la sección.", detalle: "Escribí el título de la sección." },
      { ruta: "secciones.1.campos.1.etiqueta", mensaje: "Sección 2, pregunta 2: Escribí la pregunta.", detalle: "Escribí la pregunta." },
    ]);
  });

  it("rechaza tipos desconocidos", () => {
    const e = ejemplo() as unknown as { secciones: { campos: { tipo: string }[] }[] };
    e.secciones[0].campos[0].tipo = "numero";
    expect(mensajes(validarEstructura(e))).toEqual(["Sección 1, pregunta 1: Elegí el tipo de respuesta."]);
  });

  it("controla las opciones: al menos 2, sin vacías ni repetidas", () => {
    const con = (opciones: string[] | undefined) => {
      const e = ejemplo();
      e.secciones[0].campos[1].opciones = opciones;
      return mensajes(validarEstructura(e));
    };
    expect(con(undefined)).toEqual(["Sección 1, pregunta 2: Escribí al menos 2 opciones, una por renglón."]);
    expect(con(["Natural"])).toEqual(["Sección 1, pregunta 2: Escribí al menos 2 opciones, una por renglón."]);
    expect(con(["Natural", " "])).toEqual(["Sección 1, pregunta 2: Hay una opción vacía."]);
    expect(con(["Natural", "natural"])).toEqual(["Sección 1, pregunta 2: Hay opciones repetidas."]);
    expect(con(Array.from({ length: LIMITES.opcionesMaximas + 1 }, (_, k) => `Op ${k}`))).toHaveLength(1);
    expect(con(["Natural", "x".repeat(LIMITES.opcion + 1)])).toHaveLength(1);
  });

  it("no deja repetir ni inventar identificadores", () => {
    const e = ejemplo();
    e.secciones[1].campos[0].id = "embarazo";
    expect(validarEstructura(e).ok).toBe(false);
    for (const id of ["", "Con Mayúscula", "1empieza", "con-guion", "x".repeat(LIMITES.id + 1)]) {
      const f = ejemplo();
      f.secciones[0].campos[0].id = id;
      expect(validarEstructura(f).ok, id).toBe(false);
    }
  });

  it("controla los largos", () => {
    const e = ejemplo();
    e.secciones[0].campos[0].etiqueta = "x".repeat(LIMITES.etiqueta + 1);
    e.secciones[0].titulo = "x".repeat(LIMITES.titulo + 1);
    expect(mensajes(validarEstructura(e))).toHaveLength(2);
  });

  it("limita la cantidad de preguntas en total", () => {
    const campos = (s: number) =>
      Array.from({ length: LIMITES.camposPorSeccion }, (_, k) => ({ id: `c_${s}_${k}`, etiqueta: "Pregunta", tipo: "texto" }));
    const secciones = Array.from({ length: Math.ceil(LIMITES.camposEnTotal / LIMITES.camposPorSeccion) + 1 }, (_, s) => ({
      titulo: `Sección ${s}`,
      campos: campos(s),
    }));
    expect(mensajes(validarEstructura({ secciones }))).toEqual([`La plantilla puede tener hasta ${LIMITES.camposEnTotal} preguntas.`]);
  });
});

describe("validarPlantilla", () => {
  it("acepta nombre y estructura", () => {
    const r = validarPlantilla({ nombre: "  Anamnesis infantil ", estructura: ejemplo() });
    expect(r).toEqual({ ok: true, datos: { nombre: "Anamnesis infantil", estructura: ejemplo() } });
  });

  it("junta los problemas del nombre y de la estructura", () => {
    const r = validarPlantilla({ nombre: "", estructura: { secciones: [] } });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errores).toEqual([
      { ruta: "nombre", mensaje: "Nombre: Escribí el nombre de la plantilla.", detalle: "Escribí el nombre de la plantilla." },
      { ruta: "estructura.secciones", mensaje: "Agregá al menos una sección.", detalle: "Agregá al menos una sección." },
    ]);
  });

  it("rechaza lo que no es un objeto", () => {
    expect(validarPlantilla(null).ok).toBe(false);
    expect(validarPlantilla("x").ok).toBe(false);
  });
});

describe("idParaCampo", () => {
  const nada = new Set<string>();

  it("arma el id con la pregunta, sin tildes ni signos", () => {
    expect(idParaCampo("¿Cómo fue el embarazo?", nada)).toBe("como_fue_el_embarazo");
    expect(idParaCampo("Tipo de parto", nada)).toBe("tipo_de_parto");
    expect(idParaCampo("Año de ingreso a la escuela (ñandutí)", nada)).toBe("ano_de_ingreso_a_la_escuela_nanduti");
  });

  it("no repite: agrega _2, _3…", () => {
    expect(idParaCampo("Tipo de parto", new Set(["tipo_de_parto"]))).toBe("tipo_de_parto_2");
    expect(idParaCampo("Tipo de parto", new Set(["tipo_de_parto", "tipo_de_parto_2"]))).toBe("tipo_de_parto_3");
  });

  it("siempre empieza con letra y no queda vacío", () => {
    expect(idParaCampo("", nada)).toBe("campo");
    expect(idParaCampo("¿?", nada)).toBe("campo");
    expect(idParaCampo("2 años", nada)).toBe("campo_2_anos");
  });

  it("queda corto y válido para la estructura", () => {
    const id = idParaCampo("una pregunta muy muy larga que sigue y sigue sin terminar nunca jamás", nada);
    expect(id.length).toBeLessThanOrEqual(40);
    expect(id.endsWith("_")).toBe(false);
    const e = ejemplo();
    e.secciones[0].campos[0].id = id;
    expect(validarEstructura(e).ok).toBe(true);
  });
});

describe("mover", () => {
  it("sube y baja un lugar", () => {
    expect(mover(["a", "b", "c"], 1, -1)).toEqual(["b", "a", "c"]);
    expect(mover(["a", "b", "c"], 1, 1)).toEqual(["a", "c", "b"]);
  });

  it("en los bordes no cambia nada y no toca la lista original", () => {
    const lista = ["a", "b"];
    expect(mover(lista, 0, -1)).toEqual(["a", "b"]);
    expect(mover(lista, 1, 1)).toEqual(["a", "b"]);
    expect(mover(lista, 5, -1)).toEqual(["a", "b"]);
    expect(mover(lista, 0, 1)).not.toBe(lista);
    expect(lista).toEqual(["a", "b"]);
  });
});

describe("copiarEstructura", () => {
  it("es igual pero independiente de la plantilla", () => {
    const plantilla = ejemplo();
    const copia = copiarEstructura(plantilla);
    expect(copia).toEqual(plantilla);
    plantilla.secciones[0].titulo = "Cambiado";
    plantilla.secciones[0].campos[0].etiqueta = "Cambiada";
    plantilla.secciones[0].campos[1].opciones?.push("Otra");
    expect(copia).toEqual(ejemplo());
  });
});

describe("resumenEstructura", () => {
  it("cuenta secciones y preguntas", () => {
    expect(resumenEstructura(ejemplo())).toBe("2 secciones · 5 preguntas");
    expect(resumenEstructura({ secciones: [{ titulo: "A", campos: [{ id: "a", etiqueta: "A", tipo: "texto" }] }] })).toBe(
      "1 sección · 1 pregunta",
    );
  });
});
