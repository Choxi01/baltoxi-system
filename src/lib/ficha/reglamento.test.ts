import { describe, expect, it } from "vitest";
import { estadoFirma, guardarReglamento, normalizarReglamento, textoEstadoFirma, validarFirma } from "./reglamento";

// Datos inventados.
const formulario = (datos: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(datos)) f.set(k, v);
  return f;
};

describe("normalizarReglamento", () => {
  it("saca espacios de más al final de las líneas y del texto", () => {
    expect(normalizarReglamento("  \r\nUno.   \r\n\r\nDos.  \n\n")).toBe("Uno.\n\nDos.");
  });
});

describe("guardarReglamento", () => {
  it("si el texto cambió, sube la versión", () => {
    expect(guardarReglamento({ texto: "Avisá con 24 h.", version: 1 }, "Avisá con 24 horas.")).toEqual({
      texto: "Avisá con 24 horas.",
      version: 2,
      cambio: true,
    });
  });

  it("si solo cambian espacios al final, no cambia nada", () => {
    expect(guardarReglamento({ texto: "Avisá con 24 h.", version: 3 }, "Avisá con 24 h.   \n")).toEqual({
      texto: "Avisá con 24 h.",
      version: 3,
      cambio: false,
    });
  });

  it("la primera carga (no había texto) no sube la versión: nadie pudo firmar", () => {
    expect(guardarReglamento({ texto: null, version: 1 }, "Reglamento nuevo.")).toEqual({ texto: "Reglamento nuevo.", version: 1, cambio: true });
  });

  it("borrar el texto lo deja vacío (sin reglamento en la ficha)", () => {
    expect(guardarReglamento({ texto: "Algo.", version: 2 }, "   ")).toEqual({ texto: null, version: 3, cambio: true });
  });
});

describe("validarFirma", () => {
  it("nombre, cédula sin puntos y el tilde", () => {
    expect(validarFirma(formulario({ nombre: " Laura Prueba ", cedula: "1.234.567", acepto: "on" }))).toEqual({
      ok: true,
      datos: { nombre: "Laura Prueba", cedula: "1234567" },
    });
  });

  it("sin el tilde no se acepta", () => {
    const r = validarFirma(formulario({ nombre: "Laura Prueba", cedula: "1234567" }));
    expect(!r.ok && r.errores.acepto).toBe("Marcá «Leí y acepto» para continuar.");
  });

  it("pide nombre completo y una cédula de números", () => {
    const r = validarFirma(formulario({ nombre: "La", cedula: "12a", acepto: "on" }));
    expect(!r.ok && r.errores).toEqual({
      nombre: "Escribí tu nombre completo.",
      cedula: "Escribí tu número de cédula (solo números).",
    });
  });
});

describe("estadoFirma", () => {
  const reglamento = { texto: "Reglamento de prueba.", version: 2 };
  const firma = (version: number, aceptado_en = "2026-11-01T12:00:00Z") => ({ version, aceptado_en, nombre_firmante: "Laura Prueba" });

  it("al día si firmó la versión actual", () => {
    expect(estadoFirma([firma(1), firma(2)], reglamento)).toEqual({ tipo: "al_dia", firma: firma(2) });
  });

  it("versión vieja si su última firma es de una versión anterior", () => {
    expect(estadoFirma([firma(1)], reglamento)).toEqual({ tipo: "version_vieja", firma: firma(1) });
  });

  it("sin firmar, y sin reglamento cuando el consultorio no cargó texto", () => {
    expect(estadoFirma([], reglamento)).toEqual({ tipo: "sin_firmar" });
    expect(estadoFirma([firma(1)], { texto: null, version: 1 })).toEqual({ tipo: "sin_reglamento" });
  });
});

describe("textoEstadoFirma", () => {
  const firma = (version: number) => ({ version, aceptado_en: "2026-11-07T15:00:00Z", nombre_firmante: "Laura Prueba" });
  it("un texto corto por estado (fecha en Asunción)", () => {
    expect(textoEstadoFirma({ tipo: "al_dia", firma: firma(2) }, 2)).toBe("Aceptado el 7/11/2026 (versión 2)");
    expect(textoEstadoFirma({ tipo: "version_vieja", firma: firma(1) }, 2)).toBe("Aceptó la versión 1; falta aceptar la 2");
    expect(textoEstadoFirma({ tipo: "sin_firmar" }, 2)).toBe("Sin aceptar");
    expect(textoEstadoFirma({ tipo: "sin_reglamento" }, 1)).toBeNull();
  });
});
