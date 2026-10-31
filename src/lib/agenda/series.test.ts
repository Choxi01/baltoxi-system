import { describe, expect, it } from "vitest";
import { fechasDeSerie, fechasParaHasta } from "./series";

// 2026-11-02 es lunes; "hoy" es sábado 31 de octubre.
const HOY = "2026-10-31";
const lunes = { dia_semana: 1, desde: "2026-10-01", hasta: null };

describe("fechasDeSerie", () => {
  it("8 semanas desde hoy, solo los lunes", () => {
    const fechas = fechasDeSerie(lunes, HOY, []);
    expect(fechas).toHaveLength(8);
    expect(fechas[0]).toBe("2026-11-02");
    expect(fechas.at(-1)).toBe("2026-12-21");
  });

  it("si hoy es el día de la serie, hoy cuenta", () => {
    expect(fechasDeSerie(lunes, "2026-11-02", [])[0]).toBe("2026-11-02");
  });

  it("una serie que empieza más adelante arranca en su 'desde'", () => {
    const fechas = fechasDeSerie({ ...lunes, desde: "2026-11-16" }, HOY, []);
    expect(fechas[0]).toBe("2026-11-16");
    expect(fechas).toHaveLength(6);
  });

  it("respeta el 'hasta' (incluido)", () => {
    expect(fechasDeSerie({ ...lunes, hasta: "2026-11-16" }, HOY, [])).toEqual(["2026-11-02", "2026-11-09", "2026-11-16"]);
  });

  it("una serie que ya terminó no da fechas", () => {
    expect(fechasDeSerie({ ...lunes, hasta: "2026-10-26" }, HOY, [])).toEqual([]);
  });

  it("saltea feriados y vacaciones", () => {
    const bloqueos = [
      { desde: "2026-11-09", hasta: "2026-11-09", motivo: "Feriado" },
      { desde: "2026-12-14", hasta: "2027-01-10", motivo: "Vacaciones" },
    ];
    expect(fechasDeSerie(lunes, HOY, bloqueos)).toEqual(["2026-11-02", "2026-11-16", "2026-11-23", "2026-11-30", "2026-12-07"]);
  });

  it("otro día de la semana (viernes)", () => {
    expect(fechasDeSerie({ ...lunes, dia_semana: 5 }, HOY, [], 2)).toEqual(["2026-11-06", "2026-11-13"]);
  });
});

describe("fechasParaHasta", () => {
  it("el mismo día de la semana, de a 7 días", () => {
    expect(fechasParaHasta("2026-11-02", 3)).toEqual(["2026-11-02", "2026-11-09", "2026-11-16"]);
  });
});
