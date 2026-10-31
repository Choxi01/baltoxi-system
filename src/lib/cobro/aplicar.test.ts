// Datos inventados.

import { describe, expect, it } from "vitest";
import { accionCargo, conceptoCargo, datosCargo, MES_CERRADO, mensajeErrorCobro } from "./aplicar";
import type { CargoCalculado } from "./cargo";

const calculado: CargoCalculado = {
  monto: 290000,
  porcentaje: 100,
  snapshot: { tarifa: "Regular", monto_base: 290000, estado: "presente", porcentaje: 100, origen_regla: "consultorio" },
  fecha: "2026-11-05",
  periodo: "2026-11-01",
  tutor_id: "tutor-1",
};

describe("accionCargo", () => {
  it("sin cargo y ahora corresponde → crear", () => expect(accionCargo(null, calculado)).toBe("crear"));
  it("con cargo y sigue correspondiendo → actualizar", () => expect(accionCargo({ id: "c" }, calculado)).toBe("actualizar"));
  it("un cargo de 0 también se actualiza (no se borra)", () => {
    expect(accionCargo({ id: "c" }, { ...calculado, monto: 0, porcentaje: 0 })).toBe("actualizar");
  });
  it("volvió a agendado → borrar", () => expect(accionCargo({ id: "c" }, null)).toBe("borrar"));
  it("sin cargo y no corresponde → nada", () => expect(accionCargo(null, null)).toBe("nada"));
});

describe("conceptoCargo", () => {
  it("tipo de turno y fecha", () => expect(conceptoCargo("Sesión a domicilio", "2026-11-05")).toBe("Sesión a domicilio 05/11/2026"));
  it("sin tipo dice Sesión", () => expect(conceptoCargo(null, "2026-03-09")).toBe("Sesión 09/03/2026"));
});

describe("datosCargo", () => {
  it("arma las columnas del cargo con el snapshot", () => {
    expect(datosCargo(calculado, "Sesión")).toEqual({
      tipo: "sesion",
      tutor_id: "tutor-1",
      fecha: "2026-11-05",
      periodo: "2026-11-01",
      concepto: "Sesión 05/11/2026",
      monto_gs: 290000,
      snapshot: calculado.snapshot,
    });
  });
});

describe("mensajeErrorCobro", () => {
  it("traduce los errores del motor", () => {
    expect(mensajeErrorCobro(new Error("El paciente no tiene responsable de pago"))).toMatch(/responsable de pago/);
    expect(mensajeErrorCobro(new Error("El paciente no tiene tarifa"))).toMatch(/expediente/);
    expect(mensajeErrorCobro(new Error('Falta la regla de cobro para el estado "presente"'))).toMatch(/Configuración/);
    expect(mensajeErrorCobro(new Error("El período 10/2026 está cerrado"))).toBe(MES_CERRADO);
  });
  it("cualquier otro error: mensaje general", () => expect(mensajeErrorCobro("raro")).toMatch(/Probá de nuevo/));
});
