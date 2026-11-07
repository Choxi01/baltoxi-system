import { describe, expect, it } from "vitest";

import { asignarIds, idDesdeEtiqueta, leerEstructura, mover, validarPlantilla } from "./plantilla";

// Preguntas de ejemplo (inventadas, sin datos de pacientes).
const ejemplo = {
  secciones: [
    {
      titulo: "Embarazo y parto",
      campos: [
        { id: "embarazo", etiqueta: "¿Cómo fue el embarazo?", tipo: "largo" },
        { id: "parto_tipo", etiqueta: "Tipo de parto", tipo: "opciones", opciones: ["Natural", "Cesárea"] },
        { id: "semanas", etiqueta: "Semanas de gestación", tipo: "texto" },
      ],
    },
    {
      titulo: "Desarrollo",
      campos: [
        { id: "jardin", etiqueta: "¿Va al jardín o escuela?", tipo: "si_no" },
        { id: "fecha_entrevista", etiqueta: "Fecha de la entrevista", tipo: "fecha" },
      ],
    },
  ],
};

function formulario(nombre: string, estructura: unknown) {
  const fd = new FormData();
  fd.set("nombre", nombre);
  fd.set("estructura", typeof estructura === "string" ? estructura : JSON.stringify(estructura));
  return fd;
}

const copia = <T>(v: T): T => JSON.parse(JSON.stringify(v));

describe("idDesdeEtiqueta", () => {
  it("saca acentos, signos y espacios", () => {
    expect(idDesdeEtiqueta("¿Tipo de parto?", new Set())).toBe("tipo_de_parto");
    expect(idDesdeEtiqueta("Año de inicio en el jardín", new Set())).toBe("ano_de_inicio_en_el_jardin");
  });

  it("agrega un número si ya está usado", () => {
    expect(idDesdeEtiqueta("Observaciones", new Set(["observaciones"]))).toBe("observaciones_2");
    expect(idDesdeEtiqueta("Observaciones", new Set(["observaciones", "observaciones_2"]))).toBe("observaciones_3");
  });

  it("siempre empieza con letra y nunca queda vacío", () => {
    expect(idDesdeEtiqueta("¿?", new Set())).toBe("campo");
    expect(idDesdeEtiqueta("1er año", new Set())).toBe("c_1er_ano");
  });

  it("no pasa de 40 letras", () => {
    expect(idDesdeEtiqueta("a".repeat(100), new Set()).length).toBe(40);
  });
});

describe("asignarIds", () => {
  it("pone id a los campos nuevos y respeta los que ya tienen", () => {
    const r = asignarIds([
      {
        titulo: "S",
        campos: [
          { id: "semanas", etiqueta: "Semanas (corregida)" },
          { id: "", etiqueta: "Semanas" },
          { id: "", etiqueta: "Semanas" },
        ],
      },
    ]);
    expect(r[0].campos.map((c) => c.id)).toEqual(["semanas", "semanas_2", "semanas_3"]);
  });
});

describe("mover", () => {
  it("sube y baja un lugar", () => {
    expect(mover(["a", "b", "c"], 1, -1)).toEqual(["b", "a", "c"]);
    expect(mover(["a", "b", "c"], 1, 1)).toEqual(["a", "c", "b"]);
  });

  it("en los bordes no cambia nada y no modifica la lista original", () => {
    const lista = ["a", "b"];
    expect(mover(lista, 0, -1)).toEqual(["a", "b"]);
    expect(mover(lista, 1, 1)).toEqual(["a", "b"]);
    expect(mover(lista, 5, 1)).toEqual(["a", "b"]);
    expect(mover(lista, 0, 1)).not.toBe(lista);
    expect(lista).toEqual(["a", "b"]);
  });
});

describe("validarPlantilla", () => {
  it("acepta el ejemplo de docs/expediente.md", () => {
    const r = validarPlantilla(formulario("Anamnesis infantil", ejemplo));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.datos.nombre).toBe("Anamnesis infantil");
      expect(r.datos.estructura.secciones[0].campos[1]).toEqual(ejemplo.secciones[0].campos[1]);
    }
  });

  it("pide nombre", () => {
    const r = validarPlantilla(formulario("  ", ejemplo));
    expect(r).toEqual({ ok: false, errores: { nombre: "Escribí el nombre de la plantilla." } });
  });

  it("recorta espacios y saca las opciones de los campos que no son de opciones", () => {
    const e = copia(ejemplo);
    e.secciones[0].titulo = "  Embarazo  ";
    (e.secciones[0].campos[2] as { opciones?: string[] }).opciones = ["sobra"];
    const r = validarPlantilla(formulario("A", e));
    expect(r.ok && r.datos.estructura.secciones[0].titulo).toBe("Embarazo");
    expect(r.ok && r.datos.estructura.secciones[0].campos[2]).toEqual({ id: "semanas", etiqueta: "Semanas de gestación", tipo: "texto" });
  });

  it("asigna id a los campos nuevos", () => {
    const e = copia(ejemplo);
    e.secciones[1].campos.push({ id: "", etiqueta: "¿Duerme bien?", tipo: "si_no" });
    const r = validarPlantilla(formulario("A", e));
    expect(r.ok && r.datos.estructura.secciones[1].campos[2].id).toBe("duerme_bien");
  });

  it("marca cada error en su lugar", () => {
    const e = copia(ejemplo);
    e.secciones[0].titulo = "";
    e.secciones[0].campos[0].etiqueta = " ";
    e.secciones[0].campos[1].opciones = ["Natural", "natural "];
    e.secciones[1].campos[0].tipo = "dibujo";
    const r = validarPlantilla(formulario("A", e));
    expect(r.ok).toBe(false);
    if (!r.ok)
      expect(r.errores).toEqual({
        "secciones.0.titulo": "Escribí el título de la sección.",
        "secciones.0.campos.0.etiqueta": "Escribí la pregunta.",
        "secciones.0.campos.1.opciones.1": "Esta opción está repetida.",
        "secciones.1.campos.0.tipo": "Elegí el tipo de campo.",
      });
  });

  it("un campo de opciones necesita al menos 2, sin vacías", () => {
    const e = copia(ejemplo);
    e.secciones[0].campos[1].opciones = ["Natural"];
    let r = validarPlantilla(formulario("A", e));
    expect(!r.ok && r.errores["secciones.0.campos.1.opciones"]).toBe("Poné al menos 2 opciones.");

    e.secciones[0].campos[1].opciones = ["Natural", " "];
    r = validarPlantilla(formulario("A", e));
    expect(!r.ok && r.errores["secciones.0.campos.1.opciones.1"]).toBe("Escribí la opción o quitala.");
  });

  it("no acepta plantillas ni secciones vacías", () => {
    let r = validarPlantilla(formulario("A", { secciones: [] }));
    expect(!r.ok && r.errores.secciones).toBe("Agregá al menos una sección.");
    r = validarPlantilla(formulario("A", { secciones: [{ titulo: "S", campos: [] }] }));
    expect(!r.ok && r.errores["secciones.0.campos"]).toBe("Agregá al menos un campo a la sección.");
  });

  it("no acepta ids repetidos en distintas secciones", () => {
    const e = copia(ejemplo);
    e.secciones[1].campos[0].id = "embarazo";
    const r = validarPlantilla(formulario("A", e));
    expect(!r.ok && r.errores["secciones.1.campos.0.id"]).toBe("Identificador repetido.");
  });

  it("no acepta ids con formato raro", () => {
    const e = copia(ejemplo);
    e.secciones[0].campos[0].id = "Embarazo Nº1";
    const r = validarPlantilla(formulario("A", e));
    expect(!r.ok && r.errores["secciones.0.campos.0.id"]).toBe("Identificador inválido.");
  });

  it("si el JSON está roto o no tiene forma, avisa sin romperse", () => {
    expect(validarPlantilla(formulario("A", "{no es json"))).toEqual({
      ok: false,
      errores: { general: "No se pudo leer la plantilla. Recargá la página." },
    });
    const r = validarPlantilla(formulario("A", { secciones: [{ titulo: "S", campos: [{ id: "", etiqueta: 3, tipo: "texto" }] }] }));
    expect(!r.ok && r.errores["secciones.0.campos.0.etiqueta"]).toBe("Escribí la pregunta.");
    expect(validarPlantilla(formulario("A", null)).ok).toBe(false);
    expect(validarPlantilla(formulario("A", { secciones: "x" })).ok).toBe(false);
  });
});

describe("leerEstructura", () => {
  it("lee una estructura válida", () => {
    expect(leerEstructura(ejemplo)?.secciones).toHaveLength(2);
  });

  it("devuelve null si está dañada", () => {
    expect(leerEstructura(null)).toBeNull();
    expect(leerEstructura({ secciones: [{ titulo: "S" }] })).toBeNull();
    expect(leerEstructura("texto")).toBeNull();
  });
});
