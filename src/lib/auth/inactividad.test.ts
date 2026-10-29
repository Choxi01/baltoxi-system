import { describe, expect, it } from "vitest";
import {
  LIMITE_INACTIVIDAD_MS,
  LIMITE_SESION_MS,
  leerMilisegundos,
  momentosDeIngreso,
  sesionVencida,
} from "./inactividad";

const HORA = 60 * 60 * 1000;
const DIA = 24 * HORA;
const ahora = Date.UTC(2026, 9, 29, 15, 0, 0);
const base = { ahora, ultimoUso: ahora - HORA, contrasenaEn: ahora - 2 * DIA };

describe("límites", () => {
  it("24 h sin uso y 30 días de sesión", () => {
    expect(LIMITE_INACTIVIDAD_MS).toBe(24 * HORA);
    expect(LIMITE_SESION_MS).toBe(30 * DIA);
  });
});

describe("leerMilisegundos", () => {
  it("lee un número y rechaza basura", () => {
    expect(leerMilisegundos(String(ahora))).toBe(ahora);
    expect(leerMilisegundos(undefined)).toBeNull();
    expect(leerMilisegundos("ayer")).toBeNull();
    expect(leerMilisegundos("-5")).toBeNull();
    expect(leerMilisegundos("1e30")).toBeNull();
  });
});

describe("momentosDeIngreso", () => {
  it("toma la contraseña más vieja y el código más nuevo, en ms", () => {
    expect(
      momentosDeIngreso([
        { method: "password", timestamp: 1000 },
        { method: "totp", timestamp: 2000 },
        { method: "totp", timestamp: 3000 },
      ]),
    ).toEqual({ contrasenaEn: 1_000_000, codigoEn: 3_000_000 });
  });

  it("sin datos devuelve null", () => {
    expect(momentosDeIngreso(undefined)).toEqual({ contrasenaEn: null, codigoEn: null });
    expect(momentosDeIngreso(["password"])).toEqual({ contrasenaEn: null, codigoEn: null });
  });
});

describe("sesionVencida", () => {
  it("uso normal: no vence", () => {
    expect(sesionVencida(base)).toBe(false);
  });

  it("menos de 24 h sin uso: no vence", () => {
    expect(sesionVencida({ ...base, ultimoUso: ahora - 23 * HORA })).toBe(false);
  });

  it("más de 24 h sin uso: vence", () => {
    expect(sesionVencida({ ...base, ultimoUso: ahora - 25 * HORA })).toBe(true);
  });

  it("sin dato de último uso (recién entró): no vence", () => {
    expect(sesionVencida({ ...base, ultimoUso: null })).toBe(false);
  });

  it("más de 30 días desde la contraseña: vence aunque la use todos los días", () => {
    expect(sesionVencida({ ...base, contrasenaEn: ahora - 31 * DIA })).toBe(true);
    expect(sesionVencida({ ...base, contrasenaEn: ahora - 29 * DIA })).toBe(false);
  });
});
