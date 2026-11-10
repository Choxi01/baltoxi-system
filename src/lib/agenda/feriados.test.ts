import { describe, expect, it } from "vitest";

import { aniosACargar, domingoDePascua, feriadosDelAnio } from "./feriados";

describe("domingoDePascua", () => {
  it.each([
    [2024, "2024-03-31"],
    [2025, "2025-04-20"],
    [2026, "2026-04-05"],
    [2027, "2027-03-28"],
    [2028, "2028-04-16"],
    [2038, "2038-04-25"], // la más tardía posible
    [2285, "2285-03-22"], // la más temprana posible
  ])("%i → %s", (anio, esperado) => {
    expect(domingoDePascua(anio)).toBe(esperado);
  });
});

describe("feriadosDelAnio", () => {
  it("2027: 11 feriados con Semana Santa calculada, ordenados", () => {
    const f = feriadosDelAnio(2027);
    expect(f).toHaveLength(11);
    expect(f.map((x) => x.desde)).toEqual([
      "2027-01-01",
      "2027-03-01",
      "2027-03-25",
      "2027-05-01",
      "2027-05-14",
      "2027-06-12",
      "2027-06-20",
      "2027-08-15",
      "2027-09-29",
      "2027-12-08",
      "2027-12-25",
    ]);
    expect(f[2]).toEqual({ desde: "2027-03-25", hasta: "2027-03-26", motivo: "Jueves y Viernes Santo" });
    expect(f[4].hasta).toBe("2027-05-15");
  });

  it("Semana Santa cruza de mes (Pascua 2 de abril de 2029 → 29 y 30 de marzo)", () => {
    const santa = feriadosDelAnio(2029).find((x) => x.motivo === "Jueves y Viernes Santo");
    expect(santa).toEqual({ desde: "2029-03-29", hasta: "2029-03-30", motivo: "Jueves y Viernes Santo" });
  });

  it("solo los cuatro trasladables llevan la nota del decreto", () => {
    const conNota = feriadosDelAnio(2028).filter((x) => x.motivo.includes("decreto"));
    expect(conNota.map((x) => x.desde)).toEqual(["2028-03-01", "2028-06-12", "2028-06-20", "2028-09-29"]);
  });
});

describe("aniosACargar", () => {
  it("nunca se cargó: el actual y el siguiente", () => {
    expect(aniosACargar("2026-11-10", null)).toEqual([2026, 2027]);
  });
  it("ya cargado hasta el siguiente: nada", () => {
    expect(aniosACargar("2026-11-10", 2027)).toEqual([]);
  });
  it("año nuevo: solo el que falta", () => {
    expect(aniosACargar("2027-01-01", 2027)).toEqual([2028]);
  });
  it("estuvo mucho sin usarse: no carga años viejos", () => {
    expect(aniosACargar("2030-05-02", 2027)).toEqual([2030, 2031]);
  });
});
