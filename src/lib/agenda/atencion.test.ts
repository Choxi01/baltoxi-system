import { describe, expect, it } from "vitest";
import { proximoDiaDeAtencion } from "./atencion";

// Lunes a viernes (1 a 5), como el horario por defecto.
const SEMANA = [1, 2, 3, 4, 5].map((d) => ({ dia_semana: d }));

describe("proximoDiaDeAtencion", () => {
  it("de lunes a jueves es el día siguiente", () => {
    expect(proximoDiaDeAtencion("2026-11-02", SEMANA, [])).toBe("2026-11-03");
    expect(proximoDiaDeAtencion("2026-11-05", SEMANA, [])).toBe("2026-11-06");
  });

  it("el viernes da el lunes", () => {
    expect(proximoDiaDeAtencion("2026-10-30", SEMANA, [])).toBe("2026-11-02");
  });

  it("el sábado y el domingo también dan el lunes", () => {
    expect(proximoDiaDeAtencion("2026-10-31", SEMANA, [])).toBe("2026-11-02");
    expect(proximoDiaDeAtencion("2026-11-01", SEMANA, [])).toBe("2026-11-02");
  });

  it("la víspera de un feriado saltea el feriado", () => {
    // Martes 8/12 feriado: el lunes 7/12 da el miércoles 9/12.
    expect(proximoDiaDeAtencion("2026-12-07", SEMANA, [{ desde: "2026-12-08", hasta: "2026-12-08" }])).toBe("2026-12-09");
  });

  it("un viernes antes de un lunes feriado da el martes", () => {
    expect(proximoDiaDeAtencion("2026-10-30", SEMANA, [{ desde: "2026-11-02", hasta: "2026-11-02" }])).toBe("2026-11-03");
  });

  it("vacaciones de varios días", () => {
    expect(proximoDiaDeAtencion("2026-12-18", SEMANA, [{ desde: "2026-12-21", hasta: "2027-01-08", motivo: "Vacaciones" }])).toBe(
      "2027-01-11",
    );
  });

  it("días sin horario en el medio (atiende lunes y jueves)", () => {
    const lunesYJueves = [{ dia_semana: 1 }, { dia_semana: 4 }];
    expect(proximoDiaDeAtencion("2026-11-02", lunesYJueves, [])).toBe("2026-11-05");
    expect(proximoDiaDeAtencion("2026-11-05", lunesYJueves, [])).toBe("2026-11-09");
  });

  it("sin horario cargado: null", () => {
    expect(proximoDiaDeAtencion("2026-11-02", [], [])).toBeNull();
  });
});
