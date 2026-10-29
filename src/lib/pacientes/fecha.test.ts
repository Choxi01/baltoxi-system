import { describe, expect, it } from "vitest";
import { aniosParaElegir, armarFecha, partirFecha, textoFecha } from "./fecha";

describe("armarFecha", () => {
  it("arma la fecha con ceros a la izquierda", () => {
    expect(armarFecha("5", "7", "2020")).toEqual({ ok: true, fecha: "2020-07-05" });
  });

  it("las tres vacías = sin fecha", () => {
    expect(armarFecha("", "", "")).toEqual({ ok: true, fecha: null });
  });

  it("avisa si falta una parte", () => {
    expect(armarFecha("5", "", "2020")).toMatchObject({ ok: false, error: expect.stringMatching(/Completá/) });
  });

  it("detecta fechas que no existen", () => {
    expect(armarFecha("31", "2", "2020")).toEqual({ ok: false, error: "Esa fecha no existe." });
    expect(armarFecha("31", "4", "2020")).toEqual({ ok: false, error: "Esa fecha no existe." });
    expect(armarFecha("29", "2", "2021")).toEqual({ ok: false, error: "Esa fecha no existe." });
    expect(armarFecha("29", "2", "2020")).toEqual({ ok: true, fecha: "2020-02-29" });
    expect(armarFecha("1", "13", "2020")).toEqual({ ok: false, error: "Esa fecha no existe." });
  });
});

describe("partirFecha y textoFecha", () => {
  it("parten y muestran la fecha", () => {
    expect(partirFecha("2020-07-05")).toEqual({ dia: "5", mes: "7", anio: "2020" });
    expect(partirFecha(null)).toEqual({ dia: "", mes: "", anio: "" });
    expect(textoFecha("2020-07-05")).toBe("5 de julio de 2020");
    expect(textoFecha(null)).toBeNull();
  });
});

describe("aniosParaElegir", () => {
  it("del año actual hacia atrás hasta 1900", () => {
    const anios = aniosParaElegir("2026-10-29");
    expect(anios[0]).toBe(2026);
    expect(anios.at(-1)).toBe(1900);
    expect(anios).toHaveLength(127);
  });
});
