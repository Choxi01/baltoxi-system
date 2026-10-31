// Datos inventados.

import { describe, expect, it } from "vitest";
import { accionesDelTurno, cambiosAsistencia, validarExcepcion } from "./asistencia";

const HOY = "2026-11-05";
const turno = (estado: Parameters<typeof accionesDelTurno>[0]["estado"], extra: Partial<Parameters<typeof accionesDelTurno>[0]> = {}) => ({
  clase: "turno" as const,
  estado,
  fecha: HOY,
  porcentajeManual: null,
  ...extra,
});

describe("accionesDelTurno", () => {
  it("agendado hoy o antes: Vino, No vino, Mover, Cancelar", () => {
    expect(accionesDelTurno(turno("agendado"), HOY)).toEqual(["vino", "no_vino", "mover", "cancelar"]);
    expect(accionesDelTurno(turno("agendado", { fecha: "2026-11-02" }), HOY)).toContain("vino");
  });

  it("agendado en el futuro: no se marca asistencia todavía", () => {
    expect(accionesDelTurno(turno("agendado", { fecha: "2026-11-06" }), HOY)).toEqual(["mover", "cancelar"]);
  });

  it("vino: pasar a No vino, deshacer o excepción", () => {
    expect(accionesDelTurno(turno("presente"), HOY)).toEqual(["no_vino", "agendado", "excepcion"]);
  });

  it("no vino: pasar a Vino, deshacer o excepción", () => {
    expect(accionesDelTurno(turno("ausente_sin_aviso"), HOY)).toEqual(["vino", "agendado", "excepcion"]);
  });

  it("con excepción: también se puede quitar", () => {
    expect(accionesDelTurno(turno("presente", { porcentajeManual: 50 }), HOY)).toContain("quitar_excepcion");
  });

  it("canceló la familia: solo excepción", () => {
    expect(accionesDelTurno(turno("aviso_tardio"), HOY)).toEqual(["excepcion"]);
    expect(accionesDelTurno(turno("ausente_con_aviso"), HOY)).toEqual(["excepcion"]);
  });

  it("cancelé yo y reprogramado: nada", () => {
    expect(accionesDelTurno(turno("cancelado_profesional"), HOY)).toEqual([]);
    expect(accionesDelTurno(turno("reprogramado"), HOY)).toEqual([]);
  });

  it("reservado u ocupado: mover y quitar, sin asistencia", () => {
    expect(accionesDelTurno(turno("agendado", { clase: "reservado" }), HOY)).toEqual(["mover", "quitar"]);
    expect(accionesDelTurno(turno("agendado", { clase: "ocupado" }), HOY)).toEqual(["mover", "quitar"]);
  });
});

describe("validarExcepcion", () => {
  it("porcentaje entero de 0 a 100 y motivo", () => {
    expect(validarExcepcion({ porcentaje: 0, motivo: "  Acuerdo con la familia " })).toEqual({
      ok: true,
      datos: { porcentaje: 0, motivo: "Acuerdo con la familia" },
    });
    expect(validarExcepcion({ porcentaje: 100, motivo: "x" }).ok).toBe(true);
  });

  it("rechaza porcentajes fuera de rango o con decimales", () => {
    expect(validarExcepcion({ porcentaje: 101, motivo: "x" })).toEqual({ ok: false, error: "Escribí un porcentaje de 0 a 100." });
    expect(validarExcepcion({ porcentaje: -1, motivo: "x" }).ok).toBe(false);
    expect(validarExcepcion({ porcentaje: 50.5, motivo: "x" }).ok).toBe(false);
    expect(validarExcepcion({ porcentaje: Number.NaN, motivo: "x" }).ok).toBe(false);
  });

  it("pide el motivo", () => {
    expect(validarExcepcion({ porcentaje: 50, motivo: "   " })).toEqual({ ok: false, error: "Escribí el motivo de la excepción." });
  });
});

describe("cambiosAsistencia", () => {
  const AHORA = new Date("2026-11-05T15:00:00Z");

  it("vino y no vino: cambian el estado, marcan la hora y borran la excepción", () => {
    expect(cambiosAsistencia("vino", null, AHORA)).toEqual({
      estado: "presente",
      porcentaje_manual: null,
      motivo_excepcion: null,
      marcado_en: "2026-11-05T15:00:00.000Z",
    });
    expect(cambiosAsistencia("no_vino", null, AHORA).estado).toBe("ausente_sin_aviso");
  });

  it("volver a agendado limpia todo", () => {
    expect(cambiosAsistencia("agendado", null, AHORA)).toEqual({
      estado: "agendado",
      porcentaje_manual: null,
      motivo_excepcion: null,
      marcado_en: null,
    });
  });

  it("excepción: solo porcentaje y motivo, el estado queda", () => {
    expect(cambiosAsistencia("excepcion", { porcentaje: 0, motivo: "Acuerdo" }, AHORA)).toEqual({
      porcentaje_manual: 0,
      motivo_excepcion: "Acuerdo",
    });
    expect(() => cambiosAsistencia("excepcion", null, AHORA)).toThrow();
  });

  it("quitar excepción", () => {
    expect(cambiosAsistencia("quitar_excepcion", null, AHORA)).toEqual({ porcentaje_manual: null, motivo_excepcion: null });
  });
});
