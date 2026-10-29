import { describe, expect, it } from "vitest";
import { validarNombreConsultorio } from "./consultorio";

describe("validarNombreConsultorio", () => {
  it("acepta un nombre y limpia espacios de más", () => {
    expect(validarNombreConsultorio("  Consultorio   Las Flores ")).toEqual({
      ok: true,
      nombre: "Consultorio Las Flores",
    });
  });

  it("rechaza vacío o solo espacios", () => {
    expect(validarNombreConsultorio("")).toMatchObject({ ok: false });
    expect(validarNombreConsultorio("   ")).toMatchObject({ ok: false });
    expect(validarNombreConsultorio(null)).toMatchObject({ ok: false });
  });

  it("rechaza nombres de más de 80 letras", () => {
    expect(validarNombreConsultorio("a".repeat(80))).toMatchObject({ ok: true });
    expect(validarNombreConsultorio("a".repeat(81))).toMatchObject({ ok: false });
  });
});
