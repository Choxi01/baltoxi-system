import { describe, expect, it } from "vitest";
import { MAXIMO_NOTA, fueEditada, ordenarNotas, validarNota, type Nota } from "./notas";

// Datos inventados.
const HOY = "2026-11-05";

const formulario = (datos: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(datos)) f.set(k, v);
  return f;
};

let n = 0;
const nota = (fecha: string, datos: Partial<Nota> = {}): Nota => ({
  id: `n${n++}`,
  fecha,
  texto: "Dato de prueba",
  fijada: false,
  turno_id: null,
  creado_en: `${fecha}T12:00:00Z`,
  actualizado_en: `${fecha}T12:00:00Z`,
  ...datos,
});

describe("validarNota", () => {
  it("acepta texto y fecha, sacando los espacios de los bordes", () => {
    expect(validarNota(formulario({ texto: "  Trabajamos la /r/.  ", fecha: "2026-11-03" }), HOY)).toEqual({
      ok: true,
      datos: { texto: "Trabajamos la /r/.", fecha: "2026-11-03" },
    });
  });

  it("acepta la fecha de hoy", () => {
    expect(validarNota(formulario({ texto: "Nota", fecha: HOY }), HOY).ok).toBe(true);
  });

  it("pide el texto", () => {
    const r = validarNota(formulario({ texto: "   ", fecha: HOY }), HOY);
    expect(!r.ok && r.errores.texto).toBe("Escribí la nota.");
  });

  it("no acepta una nota demasiado larga", () => {
    const r = validarNota(formulario({ texto: "a".repeat(MAXIMO_NOTA + 1), fecha: HOY }), HOY);
    expect(!r.ok && r.errores.texto).toContain("hasta");
  });

  it("rechaza fecha vacía, inexistente o futura", () => {
    for (const [fecha, error] of [
      ["", "Elegí la fecha de la nota."],
      ["2026-02-31", "Elegí la fecha de la nota."],
      ["5/11/2026", "Elegí la fecha de la nota."],
      ["2026-11-06", "La fecha no puede ser futura."],
    ]) {
      const r = validarNota(formulario({ texto: "Nota", fecha }), HOY);
      expect(!r.ok && r.errores.fecha).toBe(error);
    }
  });
});

describe("ordenarNotas", () => {
  it("la más nueva arriba; el mismo día, la última que se escribió", () => {
    const vieja = nota("2026-10-01");
    const manana = nota("2026-11-03", { creado_en: "2026-11-03T12:00:00Z" });
    const tarde = nota("2026-11-03", { creado_en: "2026-11-03T18:00:00Z" });
    const { fijada, resto } = ordenarNotas([vieja, manana, tarde]);
    expect(fijada).toBeNull();
    expect(resto).toEqual([tarde, manana, vieja]);
  });

  it("separa la fijada del resto", () => {
    const fija = nota("2026-09-01", { fijada: true });
    const otra = nota("2026-11-01");
    expect(ordenarNotas([fija, otra])).toEqual({ fijada: fija, resto: [otra] });
  });

  it("si hubiera dos fijadas, arriba va la más nueva y la otra queda en la lista", () => {
    const vieja = nota("2026-09-01", { fijada: true });
    const nueva = nota("2026-10-01", { fijada: true });
    expect(ordenarNotas([vieja, nueva])).toEqual({ fijada: nueva, resto: [vieja] });
  });

  it("sin notas", () => {
    expect(ordenarNotas([])).toEqual({ fijada: null, resto: [] });
  });
});

describe("fueEditada", () => {
  it("solo si se cambió más de un minuto después de escribirla", () => {
    expect(fueEditada({ creado_en: "2026-11-03T12:00:00Z", actualizado_en: "2026-11-03T12:00:30Z" })).toBe(false);
    expect(fueEditada({ creado_en: "2026-11-03T12:00:00Z", actualizado_en: "2026-11-04T09:00:00Z" })).toBe(true);
  });
});
