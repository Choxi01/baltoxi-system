import { describe, expect, it } from "vitest";
import { validarTutor } from "./validacion";

function formulario(datos: Record<string, string>) {
  const fd = new FormData();
  for (const [clave, valor] of Object.entries({ nombre: "María", parentesco: "madre", ...datos })) fd.set(clave, valor);
  return fd;
}

describe("validarTutor", () => {
  it("acepta lo mínimo", () => {
    expect(validarTutor(formulario({}))).toMatchObject({
      ok: true,
      datos: { nombre: "María", telefono_wa: null, email: null, doc_tipo: null, dv: null, parentesco: "madre" },
    });
  });

  it("normaliza WhatsApp y email", () => {
    const r = validarTutor(formulario({ telefono_wa: "0981 123 456", email: " Maria@Ejemplo.TEST " }));
    expect(r.ok && r.datos).toMatchObject({ telefono_wa: "595981123456", email: "maria@ejemplo.test" });
  });

  it("calcula el DV del RUC si no lo escriben", () => {
    const r = validarTutor(formulario({ doc_tipo: "RUC", doc_numero: "1.000.001" }));
    expect(r.ok && r.datos).toMatchObject({ doc_numero: "1000001", dv: "1" });
  });

  it("avisa si el DV no coincide", () => {
    const r = validarTutor(formulario({ doc_tipo: "RUC", doc_numero: "1000001", dv: "5" }));
    expect(!r.ok && r.errores.dv).toBe("El DV no coincide: para ese RUC es 1.");
  });

  it("con CI no guarda DV", () => {
    const r = validarTutor(formulario({ doc_tipo: "CI", doc_numero: "1234567", dv: "3" }));
    expect(r.ok && r.datos.dv).toBeNull();
  });

  it("pide número si eligió tipo, y tipo si escribió número", () => {
    expect(validarTutor(formulario({ doc_tipo: "CI" }))).toMatchObject({ ok: false, errores: { doc_numero: expect.any(String) } });
    expect(validarTutor(formulario({ doc_numero: "123" }))).toMatchObject({ ok: false, errores: { doc_tipo: expect.any(String) } });
  });

  it("rechaza teléfono, email y parentesco inválidos", () => {
    const r = validarTutor(formulario({ telefono_wa: "123", email: "no-es-email", parentesco: "vecino" }));
    expect(!r.ok && Object.keys(r.errores).sort()).toEqual(["email", "parentesco", "telefono_wa"]);
  });
});
