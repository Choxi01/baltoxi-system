import { describe, expect, it } from "vitest";
import { formatoGs, leerGs } from "./formato";

describe("formatoGs", () => {
  it("separa miles con punto", () => {
    expect(formatoGs(290000)).toBe("Gs. 290.000");
    expect(formatoGs(1450000)).toBe("Gs. 1.450.000");
    expect(formatoGs(0)).toBe("Gs. 0");
    expect(formatoGs(950)).toBe("Gs. 950");
  });

  it("muestra el signo en saldos a favor", () => {
    expect(formatoGs(-290000)).toBe("-Gs. 290.000");
  });

  it("no acepta decimales", () => {
    expect(() => formatoGs(290000.5)).toThrow();
  });
});

describe("leerGs", () => {
  it("lee montos escritos de varias formas", () => {
    expect(leerGs("250.000")).toBe(250000);
    expect(leerGs("Gs. 250.000")).toBe(250000);
    expect(leerGs("250000")).toBe(250000);
    expect(leerGs(" 1.450.000 ")).toBe(1450000);
  });

  it("rechaza decimales y texto", () => {
    expect(leerGs("250.000,50")).toBeNull();
    expect(leerGs("25.00")).toBeNull();
    expect(leerGs("abc")).toBeNull();
    expect(leerGs("")).toBeNull();
    expect(leerGs("-5")).toBeNull();
  });
});
