import { describe, expect, it } from "vitest";
import { mostrarTelefono, normalizarTelefono } from "./telefono";

describe("normalizarTelefono", () => {
  it("acepta como lo escribe la gente", () => {
    expect(normalizarTelefono("0981 123 456")).toBe("595981123456");
    expect(normalizarTelefono("+595 981-123456")).toBe("595981123456");
    expect(normalizarTelefono("981123456")).toBe("595981123456");
    expect(normalizarTelefono("595981123456")).toBe("595981123456");
    expect(normalizarTelefono("021 123 456")).toBe("59521123456");
  });

  it("vacío es null; números raros, inválidos", () => {
    expect(normalizarTelefono("  ")).toBeNull();
    expect(normalizarTelefono("123")).toBe("invalido");
    expect(normalizarTelefono("0981 123 456 789")).toBe("invalido");
  });
});

describe("mostrarTelefono", () => {
  it("lo muestra como en Paraguay", () => {
    expect(mostrarTelefono("595981123456")).toBe("0981 123 456");
    expect(mostrarTelefono(null)).toBeNull();
  });
});
