import { describe, expect, it } from "vitest";
import { resumenHoy, textoResumenHoy } from "./hoy";

describe("resumenHoy", () => {
  it("cuenta todos y los turnos con paciente sin marcar", () => {
    expect(
      resumenHoy([
        { clase: "turno", estado: "agendado" },
        { clase: "turno", estado: "presente" },
        { clase: "turno", estado: "aviso_tardio" },
        { clase: "reservado", estado: "agendado" },
        { clase: "ocupado", estado: "agendado" },
        { clase: "turno", estado: "agendado" },
      ]),
    ).toEqual({ total: 6, porMarcar: 2 });
  });
  it("sin turnos", () => expect(resumenHoy([])).toEqual({ total: 0, porMarcar: 0 }));
});

describe("textoResumenHoy", () => {
  it("plural y por marcar", () => expect(textoResumenHoy({ total: 4, porMarcar: 2 })).toBe("4 turnos · 2 por marcar"));
  it("singular y todo marcado", () => expect(textoResumenHoy({ total: 1, porMarcar: 0 })).toBe("1 turno · todo marcado"));
  it("sin turnos: nada", () => expect(textoResumenHoy({ total: 0, porMarcar: 0 })).toBeNull());
});
