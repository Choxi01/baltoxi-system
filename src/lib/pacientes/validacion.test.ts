import { describe, expect, it } from "vitest";
import { validarPaciente } from "./validacion";

const hoy = "2026-10-29";
const tarifa = "11111111-1111-4111-8111-111111111111";

function formulario(datos: Record<string, string>) {
  const fd = new FormData();
  const base = { nombre: "Mateo", estado: "activo", plan_cobro: "mensual" };
  for (const [clave, valor] of Object.entries({ ...base, ...datos })) fd.set(clave, valor);
  return fd;
}

describe("validarPaciente", () => {
  it("acepta lo mínimo y deja vacíos como null", () => {
    const r = validarPaciente(formulario({ apellido: "  ", colegio: "" }), hoy);
    expect(r).toEqual({
      ok: true,
      datos: expect.objectContaining({ nombre: "Mateo", apellido: null, colegio: null, monto_override_gs: null, tarifa_id: null }),
    });
  });

  it("limpia espacios y lee el precio especial en guaraníes", () => {
    const r = validarPaciente(formulario({ nombre: "  Mateo ", monto_override_gs: "Gs. 250.000", tarifa_id: tarifa }), hoy);
    expect(r.ok && r.datos).toMatchObject({ nombre: "Mateo", monto_override_gs: 250000, tarifa_id: tarifa });
  });

  it("pide el nombre", () => {
    expect(validarPaciente(formulario({ nombre: " " }), hoy)).toEqual({
      ok: false,
      errores: { nombre: "Escribí el nombre." },
    });
  });

  it("rechaza precio con decimales", () => {
    const r = validarPaciente(formulario({ monto_override_gs: "250.000,50" }), hoy);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.errores.monto_override_gs).toMatch(/sin decimales/);
  });

  it("rechaza fecha de nacimiento futura", () => {
    const r = validarPaciente(formulario({ fecha_nacimiento: "2027-01-01" }), hoy);
    expect(!r.ok && r.errores.fecha_nacimiento).toMatch(/futura/);
  });

  it("rechaza estados, planes o ids inventados", () => {
    const r = validarPaciente(formulario({ estado: "borrado", plan_cobro: "anual", tarifa_id: "x" }), hoy);
    expect(r.ok).toBe(false);
    expect(!r.ok && Object.keys(r.errores).sort()).toEqual(["estado", "plan_cobro", "tarifa_id"]);
  });
});
