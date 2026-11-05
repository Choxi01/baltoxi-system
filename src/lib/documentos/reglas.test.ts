import { describe, expect, it } from "vitest";
import { MAXIMO_BYTES, clasificarArchivo, medidasAchicadas, rutaDocumento, rutaValida, textoTamano, validarDocumento } from "./reglas";

// Datos inventados.
const HOY = "2026-11-05";
const CONSULTORIO = "11111111-1111-4111-8111-111111111111";
const PACIENTE = "22222222-2222-4222-8222-222222222222";
const OTRO = "33333333-3333-4333-8333-333333333333";
const UUID = "44444444-4444-4444-8444-444444444444";

const formulario = (datos: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(datos)) f.set(k, v);
  return f;
};

describe("clasificarArchivo", () => {
  it("las fotos se achican, también las HEIC del iPhone (aunque no traigan tipo)", () => {
    expect(clasificarArchivo({ type: "image/jpeg", name: "IMG_0001.JPG", size: 5_000_000 })).toEqual({ ok: true, accion: "achicar" });
    expect(clasificarArchivo({ type: "image/png", name: "captura.png", size: 100 })).toEqual({ ok: true, accion: "achicar" });
    expect(clasificarArchivo({ type: "", name: "IMG_0002.HEIC", size: 3_000_000 })).toEqual({ ok: true, accion: "achicar" });
    // Una foto grande igual se acepta: después de achicarla queda liviana.
    expect(clasificarArchivo({ type: "image/jpeg", name: "grande.jpg", size: MAXIMO_BYTES * 2 }).ok).toBe(true);
  });

  it("el PDF va tal cual hasta 15 MB", () => {
    expect(clasificarArchivo({ type: "application/pdf", name: "x.pdf", size: MAXIMO_BYTES })).toEqual({ ok: true, accion: "tal_cual" });
    expect(clasificarArchivo({ type: "", name: "x.PDF", size: 10 })).toEqual({ ok: true, accion: "tal_cual" });
    expect(clasificarArchivo({ type: "application/pdf", name: "x.pdf", size: MAXIMO_BYTES + 1 })).toMatchObject({ ok: false });
    expect(clasificarArchivo({ type: "application/pdf", name: "x.pdf", size: 0 })).toMatchObject({ ok: false });
  });

  it("no acepta otros archivos", () => {
    expect(clasificarArchivo({ type: "application/msword", name: "x.doc", size: 10 })).toEqual({ ok: false, error: "Solo se pueden subir fotos o PDF." });
  });
});

describe("medidasAchicadas", () => {
  it("deja el lado mayor en 2000 px manteniendo la proporción", () => {
    expect(medidasAchicadas(4032, 3024)).toEqual({ ancho: 2000, alto: 1500 });
    expect(medidasAchicadas(3024, 4032)).toEqual({ ancho: 1500, alto: 2000 });
  });

  it("nunca agranda una imagen chica", () => {
    expect(medidasAchicadas(800, 600)).toEqual({ ancho: 800, alto: 600 });
    expect(medidasAchicadas(2000, 10)).toEqual({ ancho: 2000, alto: 10 });
  });

  it("no deja un lado en 0", () => {
    expect(medidasAchicadas(10000, 1)).toEqual({ ancho: 2000, alto: 1 });
  });
});

describe("rutaDocumento y rutaValida", () => {
  it("arma <consultorio>/<paciente>/<uuid>.<ext>", () => {
    expect(rutaDocumento(CONSULTORIO, PACIENTE, UUID, "image/jpeg")).toBe(`${CONSULTORIO}/${PACIENTE}/${UUID}.jpg`);
    expect(rutaDocumento(CONSULTORIO, PACIENTE, UUID, "application/pdf")).toBe(`${CONSULTORIO}/${PACIENTE}/${UUID}.pdf`);
  });

  it("acepta solo rutas de ese consultorio, ese paciente y ese tipo de archivo", () => {
    const ruta = rutaDocumento(CONSULTORIO, PACIENTE, UUID, "image/jpeg");
    expect(rutaValida(ruta, CONSULTORIO, PACIENTE, "image/jpeg")).toBe(true);
    expect(rutaValida(ruta, CONSULTORIO, OTRO, "image/jpeg")).toBe(false);
    expect(rutaValida(ruta, OTRO, PACIENTE, "image/jpeg")).toBe(false);
    expect(rutaValida(ruta, CONSULTORIO, PACIENTE, "application/pdf")).toBe(false);
  });

  it("rechaza nombres que no son un uuid (nada de títulos ni subcarpetas)", () => {
    for (const nombre of ["informe-neurologico.jpg", `${UUID}.jpg.exe`, `../${UUID}.jpg`, `x/${UUID}.jpg`]) {
      expect(rutaValida(`${CONSULTORIO}/${PACIENTE}/${nombre}`, CONSULTORIO, PACIENTE, "image/jpeg")).toBe(false);
    }
  });
});

describe("validarDocumento", () => {
  it("tipo, título y fecha opcional", () => {
    expect(validarDocumento(formulario({ tipo: "informe", titulo: "  Informe escolar ", fecha: "" }), HOY)).toEqual({
      ok: true,
      datos: { tipo: "informe", titulo: "Informe escolar", fecha: null },
    });
    expect(validarDocumento(formulario({ tipo: "cedula", titulo: "Cédula", fecha: HOY }), HOY)).toMatchObject({
      ok: true,
      datos: { fecha: HOY },
    });
  });

  it("pide tipo y título", () => {
    const r = validarDocumento(formulario({ tipo: "receta", titulo: " ", fecha: "" }), HOY);
    expect(!r.ok && r.errores).toEqual({ tipo: "Elegí el tipo de documento.", titulo: "Escribí un título." });
  });

  it("rechaza fechas que no existen o futuras", () => {
    expect(validarDocumento(formulario({ tipo: "otro", titulo: "X", fecha: "2026-02-30" }), HOY)).toMatchObject({ ok: false, errores: { fecha: "Esa fecha no existe." } });
    expect(validarDocumento(formulario({ tipo: "otro", titulo: "X", fecha: "2026-11-06" }), HOY)).toMatchObject({
      ok: false,
      errores: { fecha: "La fecha no puede ser futura." },
    });
  });
});

describe("textoTamano", () => {
  it("en B, KB o MB con coma decimal", () => {
    expect(textoTamano(500)).toBe("500 B");
    expect(textoTamano(1536)).toBe("1,5 KB");
    expect(textoTamano(2_400_000)).toBe("2,3 MB");
  });
});
