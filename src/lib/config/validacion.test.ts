import { describe, expect, it } from "vitest";
import { validarConsultorio, validarTarifa } from "./validacion";

function formulario(datos: Record<string, string>) {
  const fd = new FormData();
  for (const [clave, valor] of Object.entries(datos)) fd.set(clave, valor);
  return fd;
}

const consultorio = (datos: Record<string, string> = {}) =>
  formulario({
    nombre: "Consultorio Prueba",
    horas_aviso_minimas: "48",
    dia_limite_pago: "10",
    concepto_factura: "Servicios de fonoaudiología",
    ...datos,
  });

describe("validarConsultorio", () => {
  it("acepta lo mínimo", () => {
    expect(validarConsultorio(consultorio())).toMatchObject({
      ok: true,
      datos: { nombre: "Consultorio Prueba", ruc: null, dv: null, profesional: null, horas_aviso_minimas: 48, dia_limite_pago: 10 },
    });
  });

  it("calcula el DV del RUC si no lo escriben", () => {
    const r = validarConsultorio(consultorio({ ruc: "1.000.001" }));
    expect(r.ok && r.datos).toMatchObject({ ruc: "1000001", dv: "1" });
  });

  it("avisa si el DV no coincide", () => {
    const r = validarConsultorio(consultorio({ ruc: "1000001", dv: "5" }));
    expect(!r.ok && r.errores.dv).toBe("El DV no coincide: para ese RUC es 1.");
  });

  it("borra el DV si no hay RUC", () => {
    const r = validarConsultorio(consultorio({ dv: "3" }));
    expect(r.ok && r.datos.dv).toBeNull();
  });

  it("rechaza día límite fuera de 1 a 28", () => {
    for (const dia of ["0", "29", "", "10.5"]) {
      const r = validarConsultorio(consultorio({ dia_limite_pago: dia }));
      expect(!r.ok && r.errores.dia_limite_pago).toBe("Elegí un día entre 1 y 28.");
    }
  });

  it("rechaza horas de aviso no enteras", () => {
    const r = validarConsultorio(consultorio({ horas_aviso_minimas: "-1" }));
    expect(!r.ok && r.errores.horas_aviso_minimas).toBeTruthy();
  });

  it("pide nombre y concepto", () => {
    const r = validarConsultorio(consultorio({ nombre: "  ", concepto_factura: "" }));
    expect(!r.ok && r.errores).toMatchObject({
      nombre: "Escribí el nombre del consultorio.",
      concepto_factura: "Escribí el concepto de la factura.",
    });
  });
});

describe("validarTarifa", () => {
  it.each(["290.000", "Gs. 290.000", "290000", " 290.000 "])("lee %s como 290000", (monto) => {
    expect(validarTarifa(formulario({ nombre: "Regular", monto_gs: monto }))).toEqual({
      ok: true,
      datos: { nombre: "Regular", monto_gs: 290000 },
    });
  });

  it("acepta 0", () => {
    const r = validarTarifa(formulario({ nombre: "Colegio", monto_gs: "0" }));
    expect(r.ok && r.datos.monto_gs).toBe(0);
  });

  it.each(["290.000,5", "", "-100", "abc"])("rechaza %s", (monto) => {
    const r = validarTarifa(formulario({ nombre: "Regular", monto_gs: monto }));
    expect(!r.ok && r.errores.monto_gs).toBe("Escribí el monto en guaraníes, sin decimales (ej. 290.000).");
  });

  it("pide el nombre", () => {
    const r = validarTarifa(formulario({ nombre: "", monto_gs: "1" }));
    expect(!r.ok && r.errores.nombre).toBe("Escribí el nombre de la tarifa.");
  });
});
