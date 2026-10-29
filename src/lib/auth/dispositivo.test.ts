import { describe, expect, it } from "vitest";
import { codigoReciente, DURACION_DISPOSITIVO_MS, formatoLlaveValido, venceDispositivo } from "./dispositivo";

const ahora = Date.UTC(2026, 9, 29, 15, 0, 0);

describe("formatoLlaveValido", () => {
  it("acepta 43 caracteres base64url", () => {
    expect(formatoLlaveValido("a".repeat(40) + "-_9")).toBe(true);
  });

  it("rechaza vacío, largo incorrecto o caracteres raros", () => {
    expect(formatoLlaveValido(undefined)).toBe(false);
    expect(formatoLlaveValido("")).toBe(false);
    expect(formatoLlaveValido("a".repeat(42))).toBe(false);
    expect(formatoLlaveValido("a".repeat(42) + "=")).toBe(false);
    expect(formatoLlaveValido("a".repeat(42) + "'")).toBe(false);
  });
});

describe("venceDispositivo", () => {
  it("vence a los 30 días", () => {
    expect(DURACION_DISPOSITIVO_MS).toBe(30 * 24 * 60 * 60 * 1000);
    expect(venceDispositivo(ahora).getTime()).toBe(ahora + DURACION_DISPOSITIVO_MS);
  });
});

describe("codigoReciente", () => {
  it("vale si se puso hace menos de 10 minutos", () => {
    expect(codigoReciente(ahora - 30_000, ahora)).toBe(true);
    expect(codigoReciente(ahora - 9 * 60_000, ahora)).toBe(true);
  });

  it("no vale si es viejo o no hay", () => {
    expect(codigoReciente(ahora - 11 * 60_000, ahora)).toBe(false);
    expect(codigoReciente(null, ahora)).toBe(false);
  });
});
