import { describe, expect, it } from "vitest";
import { LIMITE_INACTIVIDAD_MS, leerUltimoUso, sesionVencida } from "./inactividad";

const HORA = 60 * 60 * 1000;
const ahora = Date.UTC(2026, 9, 29, 15, 0, 0);

describe("leerUltimoUso", () => {
  it("lee un número de milisegundos", () => {
    expect(leerUltimoUso(String(ahora))).toBe(ahora);
  });

  it("devuelve null si falta o es basura", () => {
    expect(leerUltimoUso(undefined)).toBeNull();
    expect(leerUltimoUso("")).toBeNull();
    expect(leerUltimoUso("ayer")).toBeNull();
    expect(leerUltimoUso("-5")).toBeNull();
    expect(leerUltimoUso("1e30")).toBeNull();
  });
});

describe("sesionVencida", () => {
  it("el límite es de 12 horas", () => {
    expect(LIMITE_INACTIVIDAD_MS).toBe(12 * HORA);
  });

  it("no vence si se usó hace menos de 12 h", () => {
    expect(sesionVencida(ahora - 11 * HORA, ahora)).toBe(false);
    expect(sesionVencida(ahora - 12 * HORA, ahora)).toBe(false);
  });

  it("vence si pasaron más de 12 h", () => {
    expect(sesionVencida(ahora - 12 * HORA - 1, ahora)).toBe(true);
    expect(sesionVencida(ahora - 3 * 24 * HORA, ahora)).toBe(true);
  });

  it("sin dato no vence (recién entró)", () => {
    expect(sesionVencida(null, ahora)).toBe(false);
  });
});
