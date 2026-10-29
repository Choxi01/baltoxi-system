import { describe, expect, it } from "vitest";
import { codigoErrorIngreso, mensajeErrorIngreso } from "./ingreso";

describe("codigoErrorIngreso", () => {
  it("distingue datos incorrectos de otros problemas", () => {
    expect(codigoErrorIngreso("invalid_credentials")).toBe("datos");
    expect(codigoErrorIngreso("over_request_rate_limit")).toBe("conexion");
    expect(codigoErrorIngreso(undefined)).toBe("conexion");
  });
});

describe("mensajeErrorIngreso", () => {
  it("muestra un mensaje en español para cada código", () => {
    expect(mensajeErrorIngreso("datos")).toMatch(/no son correctos/);
    expect(mensajeErrorIngreso("conexion")).toMatch(/conexión/);
  });

  it("sin error o con un código inventado no muestra nada", () => {
    expect(mensajeErrorIngreso(null)).toBeNull();
    expect(mensajeErrorIngreso("<script>")).toBeNull();
  });
});
