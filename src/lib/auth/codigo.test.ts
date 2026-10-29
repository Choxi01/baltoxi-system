import { describe, expect, it } from "vitest";
import { codigoCompleto, limpiarCodigo } from "./codigo";

describe("limpiarCodigo", () => {
  it("saca espacios y letras y corta en 6", () => {
    expect(limpiarCodigo("123 456")).toBe("123456");
    expect(limpiarCodigo("12a3-45")).toBe("12345");
    expect(limpiarCodigo("12345678")).toBe("123456");
  });
});

describe("codigoCompleto", () => {
  it("solo acepta 6 dígitos", () => {
    expect(codigoCompleto("123456")).toBe(true);
    expect(codigoCompleto("12345")).toBe(false);
    expect(codigoCompleto("12345a")).toBe(false);
  });
});
