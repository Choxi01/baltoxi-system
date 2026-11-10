import { describe, expect, it } from "vitest";

import type { Estructura } from "./estructura";
import { leerRespuestas, progresoRespuestas, textoRespuesta, validarRespuestas } from "./respuestas";

// Plantilla inventada, igual a la del seed.
const estructura: Estructura = {
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
        { id: "jardin", etiqueta: "¿Va al jardín?", tipo: "si_no" },
        { id: "control", etiqueta: "Último control", tipo: "fecha" },
      ],
    },
  ],
};
const [embarazo, parto, , jardin, control] = estructura.secciones.flatMap((s) => s.campos);

describe("validarRespuestas", () => {
  it("acepta cada tipo y descarta vacíos y preguntas que no existen", () => {
    const r = validarRespuestas(estructura, {
      embarazo: "Dato de prueba.",
      parto_tipo: "Natural",
      semanas: "  ",
      jardin: false,
      control: "2026-02-28",
      inventada: "x",
    });
    expect(r).toEqual({
      ok: true,
      respuestas: { embarazo: "Dato de prueba.", parto_tipo: "Natural", jardin: false, control: "2026-02-28" },
    });
  });

  it("rechaza una opción que no está en la lista, con el lugar de la pregunta", () => {
    expect(validarRespuestas(estructura, { parto_tipo: "Otro" })).toEqual({ ok: false, error: "Sección 1, pregunta 2: Elegí una de las opciones." });
  });

  it("rechaza Sí / No que no sea boolean", () => {
    expect(validarRespuestas(estructura, { jardin: "si" }).ok).toBe(false);
  });

  it("rechaza fechas imposibles o con otro formato", () => {
    expect(validarRespuestas(estructura, { control: "2026-02-30" }).ok).toBe(false);
    expect(validarRespuestas(estructura, { control: "28/02/2026" }).ok).toBe(false);
  });

  it("controla el largo de los textos", () => {
    expect(validarRespuestas(estructura, { semanas: "x".repeat(1001) }).ok).toBe(false);
    expect(validarRespuestas(estructura, { embarazo: "x".repeat(10000) }).ok).toBe(true);
    expect(validarRespuestas(estructura, { embarazo: "x".repeat(10001) }).ok).toBe(false);
  });

  it("el error nunca lleva lo que se respondió", () => {
    const r = validarRespuestas(estructura, { semanas: `secreto${"x".repeat(1000)}` });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).not.toContain("secreto");
  });

  it("rechaza lo que no es un objeto", () => {
    expect(validarRespuestas(estructura, null).ok).toBe(false);
    expect(validarRespuestas(estructura, []).ok).toBe(false);
  });
});

describe("leerRespuestas", () => {
  it("se queda con lo válido y nunca falla", () => {
    expect(leerRespuestas(estructura, { embarazo: "Bien", parto_tipo: "Otro", jardin: true })).toEqual({ embarazo: "Bien", jardin: true });
    expect(leerRespuestas(estructura, "basura")).toEqual({});
  });
});

describe("textoRespuesta y progresoRespuestas", () => {
  it("muestra Sí / No, fechas y textos", () => {
    expect(textoRespuesta(jardin, true)).toBe("Sí");
    expect(textoRespuesta(jardin, false)).toBe("No");
    expect(textoRespuesta(control, "2026-02-05")).toBe("5 de febrero de 2026");
    expect(textoRespuesta(parto, "Cesárea")).toBe("Cesárea");
    expect(textoRespuesta(embarazo, undefined)).toBeNull();
  });

  it("cuenta las respondidas", () => {
    expect(progresoRespuestas(estructura, { embarazo: "x", jardin: false })).toBe("2 de 5 respondidas");
  });
});
