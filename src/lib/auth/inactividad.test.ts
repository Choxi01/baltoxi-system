import { describe, expect, it } from "vitest";
import {
  LIMITE_INACTIVIDAD_MS,
  LIMITE_SESION_MS,
  evaluarSesion,
  leerMilisegundos,
  momentosDeIngreso,
} from "./inactividad";

const HORA = 60 * 60 * 1000;
const DIA = 24 * HORA;
const ahora = Date.UTC(2026, 9, 29, 15, 0, 0);

const base = {
  ahora,
  ultimoUso: ahora - HORA,
  bloqueadaDesde: null,
  contrasenaEn: ahora - 2 * DIA,
  codigoEn: ahora - 2 * DIA,
};

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

describe("evaluarSesion", () => {
  it("uso normal: sigue sin bloquear", () => {
    expect(evaluarSesion(base)).toEqual({ accion: "seguir", bloqueadaDesde: null });
  });

  it("menos de 24 h sin uso: no bloquea", () => {
    expect(evaluarSesion({ ...base, ultimoUso: ahora - 23 * HORA })).toEqual({
      accion: "seguir",
      bloqueadaDesde: null,
    });
  });

  it("más de 24 h sin uso: bloquea (pide solo el código)", () => {
    expect(evaluarSesion({ ...base, ultimoUso: ahora - 25 * HORA })).toEqual({
      accion: "seguir",
      bloqueadaDesde: ahora,
    });
  });

  it("sigue bloqueada aunque ahora la use, hasta que ponga el código", () => {
    const bloqueadaDesde = ahora - 10 * 60 * 1000;
    expect(evaluarSesion({ ...base, bloqueadaDesde })).toEqual({ accion: "seguir", bloqueadaDesde });
  });

  it("un código viejo (de antes del bloqueo) no desbloquea", () => {
    const bloqueadaDesde = ahora - 60 * 1000;
    expect(evaluarSesion({ ...base, bloqueadaDesde, codigoEn: bloqueadaDesde - 5000 })).toEqual({
      accion: "seguir",
      bloqueadaDesde,
    });
  });

  it("poner el código después del bloqueo desbloquea (aunque sea en el mismo segundo)", () => {
    const bloqueadaDesde = ahora - 60 * 1000 + 700; // 0,7 s dentro de un segundo
    expect(evaluarSesion({ ...base, bloqueadaDesde, codigoEn: ahora - 60 * 1000 })).toEqual({
      accion: "seguir",
      bloqueadaDesde: null,
    });
  });

  it("más de 30 días desde la contraseña: cierra la sesión", () => {
    expect(evaluarSesion({ ...base, contrasenaEn: ahora - 31 * DIA })).toEqual({ accion: "cerrar" });
  });

  it("los 30 días se cuentan desde la contraseña, aunque la use todos los días", () => {
    expect(evaluarSesion({ ...base, contrasenaEn: ahora - 29 * DIA })).toMatchObject({ accion: "seguir" });
  });
});
