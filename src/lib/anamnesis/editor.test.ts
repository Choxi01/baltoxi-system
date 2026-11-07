import { describe, expect, it } from "vitest";

import {
  aEditor,
  aEstructura,
  agregarCampo,
  cambiarCampo,
  cambiarSeccion,
  contarCampos,
  moverCampo,
  moverSeccion,
  quitarCampo,
  quitarSeccion,
} from "./editor";
import { validarPlantilla, type Estructura } from "./plantilla";

const estructura: Estructura = {
  secciones: [
    {
      titulo: "Embarazo y parto",
      campos: [
        { id: "embarazo", etiqueta: "¿Cómo fue el embarazo?", tipo: "largo" },
        { id: "parto_tipo", etiqueta: "Tipo de parto", tipo: "opciones", opciones: ["Natural", "Cesárea"] },
      ],
    },
    { titulo: "Desarrollo", campos: [{ id: "jardin", etiqueta: "¿Va al jardín?", tipo: "si_no" }] },
  ],
};

function claves() {
  let n = 0;
  return () => `k${++n}`;
}

describe("aEditor / aEstructura", () => {
  it("ida y vuelta deja la misma estructura", () => {
    expect(aEstructura(aEditor(estructura, claves()))).toEqual(estructura);
  });

  it("sin plantilla arranca con una sección y un campo vacíos", () => {
    const e = aEditor(null, claves());
    expect(e).toHaveLength(1);
    expect(e[0].campos).toEqual([{ clave: "k2", id: "", etiqueta: "", tipo: "texto", opciones: ["", ""] }]);
  });

  it("las opciones solo viajan en los campos de opciones, pero no se pierden si se vuelve al tipo", () => {
    let e = aEditor(estructura, claves());
    e = cambiarCampo(e, 0, 1, { tipo: "texto" });
    expect(aEstructura(e).secciones[0].campos[1]).toEqual({ id: "parto_tipo", etiqueta: "Tipo de parto", tipo: "texto" });
    e = cambiarCampo(e, 0, 1, { tipo: "opciones" });
    expect(aEstructura(e).secciones[0].campos[1].opciones).toEqual(["Natural", "Cesárea"]);
  });
});

describe("cambios", () => {
  it("reordena secciones y campos", () => {
    let e = aEditor(estructura, claves());
    e = moverSeccion(e, 1, -1);
    expect(e.map((s) => s.titulo)).toEqual(["Desarrollo", "Embarazo y parto"]);
    e = moverCampo(e, 1, 0, 1);
    expect(e[1].campos.map((c) => c.id)).toEqual(["parto_tipo", "embarazo"]);
  });

  it("agrega y quita", () => {
    const clave = claves();
    let e = aEditor(estructura, clave);
    e = agregarCampo(e, 1, clave);
    expect(e[1].campos).toHaveLength(2);
    expect(e[1].campos[1].id).toBe("");
    e = quitarCampo(e, 0, 0);
    expect(e[0].campos.map((c) => c.id)).toEqual(["parto_tipo"]);
    e = quitarSeccion(e, 0);
    expect(e.map((s) => s.titulo)).toEqual(["Desarrollo"]);
  });

  it("no modifica el estado anterior", () => {
    const e = aEditor(estructura, claves());
    const antes = JSON.stringify(e);
    cambiarSeccion(e, 0, { titulo: "Otro" });
    cambiarCampo(e, 0, 0, { etiqueta: "Otra" });
    expect(JSON.stringify(e)).toBe(antes);
  });

  it("lo que arma el editor pasa la validación del servidor (con ids nuevos)", () => {
    const clave = claves();
    let e = aEditor(estructura, clave);
    e = agregarCampo(e, 1, clave);
    e = cambiarCampo(e, 1, 1, { etiqueta: "¿Duerme bien?", tipo: "si_no" });
    const fd = new FormData();
    fd.set("nombre", "Prueba");
    fd.set("estructura", JSON.stringify(aEstructura(e)));
    const r = validarPlantilla(fd);
    expect(r.ok && r.datos.estructura.secciones[1].campos.map((c) => c.id)).toEqual(["jardin", "duerme_bien"]);
  });
});

describe("contarCampos", () => {
  it("suma los campos de todas las secciones", () => {
    expect(contarCampos(estructura)).toBe(3);
  });
});
