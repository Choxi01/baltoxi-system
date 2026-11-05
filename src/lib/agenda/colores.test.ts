import { describe, expect, it } from "vitest";
import { CLASES_COLOR, COLORES_TIPO, colorDeTipo, colorSugerido, estiloTurno, leyendaTipos } from "./colores";

const turno = (datos: Partial<Parameters<typeof estiloTurno>[0]> = {}) => ({
  clase: "turno",
  estado: "agendado",
  color: "lavanda",
  porcentajeManual: null,
  ...datos,
});

describe("colorDeTipo", () => {
  it("usa el color del tipo o, si no tiene o no existe, el de por defecto", () => {
    expect(colorDeTipo("durazno")).toBe("durazno");
    expect(colorDeTipo(null)).toBe("cielo");
    expect(colorDeTipo("fucsia")).toBe("cielo");
  });
});

describe("colorSugerido", () => {
  it("sugiere el primer color que no usa ningún tipo", () => {
    expect(colorSugerido([])).toBe("cielo");
    expect(colorSugerido(["cielo", "lavanda", null])).toBe("durazno");
  });

  it("con la paleta entera usada, los repite en orden", () => {
    expect(colorSugerido([...COLORES_TIPO])).toBe("cielo");
    expect(colorSugerido([...COLORES_TIPO, "cielo"])).toBe("durazno");
  });
});

describe("estiloTurno", () => {
  it("agendado: relleno y borde finito del color del tipo, sin ícono", () => {
    const e = estiloTurno(turno());
    expect(e.marca).toBeNull();
    expect(e.clases).toContain(CLASES_COLOR.lavanda.relleno);
    expect(e.clases).toContain(CLASES_COLOR.lavanda.borde);
  });

  it("vino: borde verde grueso y ✓; no vino: borde rojo y ✕ (el relleno sigue siendo el del tipo)", () => {
    const vino = estiloTurno(turno({ estado: "presente" }));
    expect(vino.marca).toBe("vino");
    expect(vino.clases).toContain("border-emerald-600");
    expect(vino.clases).toContain(CLASES_COLOR.lavanda.relleno);

    const noVino = estiloTurno(turno({ estado: "ausente_sin_aviso" }));
    expect(noVino.marca).toBe("no_vino");
    expect(noVino.clases).toContain("border-rose-600");
  });

  it("marca la excepción de cobro", () => {
    expect(estiloTurno(turno({ estado: "presente", porcentajeManual: 0 })).excepcion).toBe(true);
    expect(estiloTurno(turno()).excepcion).toBe(false);
  });

  it("reservado y ocupado van en gris, aunque tengan tipo", () => {
    for (const clase of ["reservado", "ocupado"]) {
      const e = estiloTurno(turno({ clase }));
      expect(e).toEqual({ clases: expect.stringContaining("bg-muted"), marca: null, excepcion: false });
    }
  });
});

describe("leyendaTipos", () => {
  it("un tipo por nombre, ordenados, sin reservados ni ocupados", () => {
    const turnos = [
      { clase: "turno", tipo: "Sesión", color: "cielo" },
      { clase: "turno", tipo: "Evaluación", color: "arena" },
      { clase: "turno", tipo: "Sesión", color: "cielo" },
      { clase: "turno", tipo: null, color: null },
      { clase: "ocupado", tipo: "Reunión de equipo", color: "pizarra" },
    ];
    expect(leyendaTipos(turnos)).toEqual([
      { nombre: "Evaluación", color: "arena" },
      { nombre: "Sesión", color: "cielo" },
    ]);
  });
});
