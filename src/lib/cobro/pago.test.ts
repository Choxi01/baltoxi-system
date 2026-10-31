// Pagos: validación, "Cobrar ahora" y deuda anterior. Datos inventados.

import { describe, expect, it } from "vitest";
import { cobroDelCargo, puedeCobrarAhora, validarPago } from "./pago";
import { imputarPagos } from "./saldo";

const TUTOR = "11111111-1111-4111-8111-111111111111";
const HOY = "2026-11-10";
const valido = { tutor_id: TUTOR, fecha: HOY, monto: "290.000", medio: "efectivo", referencia: "" };

describe("validarPago", () => {
  it("acepta un pago completo y pasa el monto a entero", () => {
    expect(validarPago(valido, HOY)).toEqual({
      ok: true,
      datos: { tutor_id: TUTOR, fecha: HOY, monto_gs: 290000, medio: "efectivo", referencia: null },
    });
  });

  it("acepta el monto sin puntos y recorta la referencia", () => {
    const r = validarPago({ ...valido, monto: "290000", medio: "transferencia", referencia: "  Op 123  " }, HOY);
    expect(r).toMatchObject({ ok: true, datos: { monto_gs: 290000, medio: "transferencia", referencia: "Op 123" } });
  });

  it("acepta una fecha pasada", () => {
    expect(validarPago({ ...valido, fecha: "2026-10-31" }, HOY).ok).toBe(true);
  });

  it("no acepta una fecha futura (mañana en Asunción)", () => {
    expect(validarPago({ ...valido, fecha: "2026-11-11" }, HOY)).toEqual({ ok: false, errores: { fecha: "La fecha no puede ser futura." } });
  });

  it("no acepta una fecha que no existe", () => {
    expect(validarPago({ ...valido, fecha: "2026-02-30" }, HOY)).toMatchObject({ ok: false, errores: { fecha: "Poné una fecha válida." } });
  });

  it.each(["", "0", "290.000,50", "-5000", "abc"])("no acepta el monto %j", (monto) => {
    expect(validarPago({ ...valido, monto }, HOY)).toMatchObject({ ok: false, errores: { monto: expect.any(String) } });
  });

  it("solo efectivo o transferencia", () => {
    expect(validarPago({ ...valido, medio: "tarjeta" }, HOY)).toMatchObject({ ok: false, errores: { medio: expect.any(String) } });
  });

  it("tutor inválido y referencia larga", () => {
    const r = validarPago({ ...valido, tutor_id: "x", referencia: "a".repeat(101) }, HOY);
    expect(r).toMatchObject({ ok: false, errores: { tutor_id: expect.any(String), referencia: expect.any(String) } });
  });

  it("entrada vacía", () => {
    expect(validarPago(null, HOY).ok).toBe(false);
  });
});

describe("puedeCobrarAhora", () => {
  const base = { clase: "turno", estado: "presente" as const, cobraEnElMomento: false, plan: "por_sesion" as const, pendiente: 290000 };

  it("plan por sesión con pendiente", () => expect(puedeCobrarAhora(base)).toBe(true));
  it("tipo que cobra en el momento aunque el plan sea mensual", () =>
    expect(puedeCobrarAhora({ ...base, plan: "mensual", cobraEnElMomento: true })).toBe(true));
  it("plan mensual o semanal sin cobro en el momento: no", () => {
    expect(puedeCobrarAhora({ ...base, plan: "mensual" })).toBe(false);
    expect(puedeCobrarAhora({ ...base, plan: "semanal" })).toBe(false);
  });
  it("ya pagado: no", () => expect(puedeCobrarAhora({ ...base, pendiente: 0 })).toBe(false));
  it("agendado o sin paciente: no", () => {
    expect(puedeCobrarAhora({ ...base, estado: "agendado" })).toBe(false);
    expect(puedeCobrarAhora({ ...base, clase: "reservado" })).toBe(false);
  });
});

describe("cobroDelCargo", () => {
  const cargos = [
    { id: "sep", fecha: "2026-09-15", monto_gs: 290000 },
    { id: "oct", fecha: "2026-10-15", monto_gs: 290000 },
    { id: "nov", fecha: "2026-11-10", monto_gs: 290000 },
  ];

  it("sin pagos: la deuda anterior son los dos cargos viejos", () => {
    expect(cobroDelCargo("nov", imputarPagos({ cargos, pagos: [] }))).toEqual({ pendiente: 290000, deudaAnterior: 580000 });
  });

  it("con un pago parcial, FIFO cubre primero lo más viejo", () => {
    const pagos = [{ id: "p1", fecha: "2026-10-20", monto_gs: 400000 }];
    expect(cobroDelCargo("nov", imputarPagos({ cargos, pagos }))).toEqual({ pendiente: 290000, deudaAnterior: 180000 });
  });

  it("sin deuda anterior", () => {
    const pagos = [{ id: "p1", fecha: "2026-10-20", monto_gs: 580000 }];
    expect(cobroDelCargo("nov", imputarPagos({ cargos, pagos }))).toEqual({ pendiente: 290000, deudaAnterior: 0 });
  });

  it("cargo que no está", () => {
    expect(cobroDelCargo("otro", imputarPagos({ cargos, pagos: [] }))).toBeNull();
  });
});
