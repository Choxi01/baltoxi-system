import { describe, expect, it } from "vitest";
import { calcularDv } from "./ruc";

describe("calcularDv (módulo 11)", () => {
  it("calcula el DV paso a paso", () => {
    // 1000001 al revés: 1·2 + 0·3 + 0·4 + 0·5 + 0·6 + 0·7 + 1·8 = 10 → resto 10 → 11 − 10 = 1
    expect(calcularDv("1000001")).toBe(1);
    // 5: 5·2 = 10 → resto 10 → 1
    expect(calcularDv("5")).toBe(1);
    // 6: 6·2 = 12 → resto 1 → (resto ≤ 1) → 0
    expect(calcularDv("6")).toBe(0);
    // 80000000: 8·9 = 72 → resto 6 → 5
    expect(calcularDv("80000000")).toBe(5);
  });

  it("coincide con RUC públicos de empresas", () => {
    expect(calcularDv("80009735")).toBe(1); // ANDE
    expect(calcularDv("80000519")).toBe(8); // Telecel
  });

  it("ignora los puntos", () => {
    expect(calcularDv("1.000.001")).toBe(1);
  });

  it("rechaza lo que no es número", () => {
    expect(calcularDv("")).toBeNull();
    expect(calcularDv("12a")).toBeNull();
  });
});
