import { describe, expect, it } from "vitest";
import { edad, textoEdad } from "./edad";

describe("edad", () => {
  it("cuenta años y meses cumplidos", () => {
    expect(edad("2020-07-15", "2026-10-29")).toEqual({ anios: 6, meses: 3 });
  });

  it("el día del cumpleaños ya cumple", () => {
    expect(edad("2020-10-29", "2026-10-29")).toEqual({ anios: 6, meses: 0 });
    expect(edad("2020-10-30", "2026-10-29")).toEqual({ anios: 5, meses: 11 });
  });

  it("nacido el 29/2: en años no bisiestos cumple el 28/2 o 1/3, nunca antes", () => {
    expect(edad("2020-02-29", "2027-02-27")).toEqual({ anios: 6, meses: 11 });
    expect(edad("2020-02-29", "2027-03-01")).toEqual({ anios: 7, meses: 0 });
  });

  it("fecha futura o inválida: null", () => {
    expect(edad("2030-01-01", "2026-10-29")).toBeNull();
    expect(edad("no-es-fecha", "2026-10-29")).toBeNull();
  });
});

describe("textoEdad", () => {
  const hoy = "2026-10-29";
  it("arma el texto en español", () => {
    expect(textoEdad("2020-07-15", hoy)).toBe("6 años y 3 meses");
    expect(textoEdad("2025-10-29", hoy)).toBe("1 año");
    expect(textoEdad("2025-09-01", hoy)).toBe("1 año y 1 mes");
    expect(textoEdad("2025-12-01", hoy)).toBe("10 meses");
    expect(textoEdad("2026-09-20", hoy)).toBe("1 mes");
    expect(textoEdad("2026-10-20", hoy)).toBe("menos de 1 mes");
  });

  it("sin fecha no muestra nada", () => {
    expect(textoEdad(null, hoy)).toBeNull();
  });
});
