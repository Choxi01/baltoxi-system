import { describe, expect, it } from "vitest";
import {
  MAXIMO_FALLIDOS_POR_IP,
  MAXIMO_GUARDADOS_POR_LINK,
  claveFallidos,
  claveGuardados,
  esTokenValido,
  inicioDeVentana,
  superaLimite,
  validarHijoFicha,
  validarOtroTutor,
} from "./reglas";

// Datos inventados.
const HOY = "2026-11-06";

const formulario = (datos: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(datos)) f.set(k, v);
  return f;
};

describe("esTokenValido", () => {
  it("solo un uuid", () => {
    expect(esTokenValido("2f1c3a4b-5d6e-4f70-8a9b-0c1d2e3f4a5b")).toBe(true);
    for (const token of ["", "abc", "1 or 1=1", "../admin", "2f1c3a4b-5d6e-4f70-8a9b-0c1d2e3f4a5"]) {
      expect(esTokenValido(token)).toBe(false);
    }
  });
});

describe("límite de intentos", () => {
  it("10 links fallidos por IP y 30 guardados por link, por hora", () => {
    expect(MAXIMO_FALLIDOS_POR_IP).toBe(10);
    expect(MAXIMO_GUARDADOS_POR_LINK).toBe(30);
    expect(superaLimite(9, MAXIMO_FALLIDOS_POR_IP)).toBe(false);
    expect(superaLimite(10, MAXIMO_FALLIDOS_POR_IP)).toBe(true);
    expect(superaLimite(29, MAXIMO_GUARDADOS_POR_LINK)).toBe(false);
    expect(superaLimite(30, MAXIMO_GUARDADOS_POR_LINK)).toBe(true);
  });

  it("la ventana es la última hora", () => {
    expect(inicioDeVentana(new Date("2026-11-06T15:30:00Z"))).toBe("2026-11-06T14:30:00.000Z");
  });

  it("las claves separan fallidos por IP de guardados por link", () => {
    expect(claveFallidos("abc")).toBe("ficha-fallido:abc");
    expect(claveGuardados("abc")).toBe("ficha-guardado:abc");
  });
});

describe("validarHijoFicha", () => {
  it("nombre obligatorio; apellido, fecha y colegio opcionales", () => {
    expect(validarHijoFicha(formulario({ nombre: " Tomi ", apellido: "", fecha_nacimiento: "", colegio: "" }), HOY)).toEqual({
      ok: true,
      datos: { nombre: "Tomi", apellido: null, fecha_nacimiento: null, colegio: null },
    });
    expect(
      validarHijoFicha(formulario({ nombre: "Tomi", apellido: "Prueba", fecha_nacimiento: "2019-04-12", colegio: "Escuela Inventada" }), HOY),
    ).toMatchObject({ ok: true, datos: { fecha_nacimiento: "2019-04-12", colegio: "Escuela Inventada" } });
  });

  it("rechaza nombre vacío y fechas imposibles o futuras", () => {
    expect(validarHijoFicha(formulario({ nombre: "" }), HOY)).toMatchObject({ ok: false, errores: { nombre: "Escribí el nombre." } });
    for (const fecha of ["2019-02-30", "2027-01-01", "1890-05-05"]) {
      const r = validarHijoFicha(formulario({ nombre: "Tomi", fecha_nacimiento: fecha }), HOY);
      expect(r.ok).toBe(false);
    }
  });

  it("no lee campos que la familia no puede tocar (motivo, tarifa, estado)", () => {
    const r = validarHijoFicha(formulario({ nombre: "Tomi", motivo_consulta: "x", tarifa_id: "y", estado: "alta" }), HOY);
    expect(r.ok && Object.keys(r.datos).sort()).toEqual(["apellido", "colegio", "fecha_nacimiento", "nombre"]);
  });
});

describe("validarOtroTutor", () => {
  it("nombre, parentesco y WhatsApp obligatorio (normalizado)", () => {
    expect(validarOtroTutor(formulario({ nombre: "Ana", apellido: "", telefono_wa: "0981 123 456", parentesco: "abuela" }))).toEqual({
      ok: true,
      datos: { nombre: "Ana", apellido: null, telefono_wa: "595981123456", parentesco: "abuela" },
    });
  });

  it("pide el WhatsApp y un parentesco de la lista", () => {
    const r = validarOtroTutor(formulario({ nombre: "Ana", telefono_wa: "", parentesco: "vecina" }));
    expect(!r.ok && r.errores).toEqual({ telefono_wa: "Escribí el WhatsApp (ej. 0981 123 456).", parentesco: "Elegí el parentesco." });
  });
});
