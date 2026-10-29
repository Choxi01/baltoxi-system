import { describe, expect, it } from "vitest";
import { aHora, aMinutos, bloqueoDelDia, bloquesDelDia, diaSemana, horaCorta, type Tramo } from "./bloques";

// Lunes a viernes, 9:00–11:15 y 13:30–17:15 (el ejemplo de docs/agenda.md).
const HORARIO: Tramo[] = [1, 2, 3, 4, 5].flatMap((d) => [
  { dia_semana: d, desde: "09:00:00", hasta: "11:15:00" },
  { dia_semana: d, desde: "13:30:00", hasta: "17:15:00" },
]);
const inicios = (fecha: string, horario = HORARIO, duracion = 45, bloqueos = []) =>
  bloquesDelDia(fecha, horario, duracion, bloqueos).map((b) => horaCorta(b.inicio));

// 2026-11-02 es lunes.
describe("bloquesDelDia", () => {
  it("horario partido: el ejemplo de la especificación", () => {
    expect(inicios("2026-11-02")).toEqual(["9:00", "9:45", "10:30", "13:30", "14:15", "15:00", "15:45", "16:30"]);
  });

  it("cada bloque tiene inicio y fin", () => {
    expect(bloquesDelDia("2026-11-02", HORARIO, 45, [])[0]).toEqual({ inicio: "09:00", fin: "09:45" });
  });

  it("un bloque que no entra entero no existe", () => {
    // 9:00–10:00 con 45 min: solo 9:00 (9:45–10:30 se pasa).
    expect(inicios("2026-11-02", [{ dia_semana: 1, desde: "09:00", hasta: "10:00" }])).toEqual(["9:00"]);
    // Tramo más corto que un bloque: nada.
    expect(inicios("2026-11-02", [{ dia_semana: 1, desde: "09:00", hasta: "09:30" }])).toEqual([]);
  });

  it("un bloque que termina justo en el límite sí entra", () => {
    expect(inicios("2026-11-02", [{ dia_semana: 1, desde: "09:00", hasta: "10:30" }])).toEqual(["9:00", "9:45"]);
  });

  it("día sin horario (sábado y domingo): sin bloques", () => {
    expect(inicios("2026-11-07")).toEqual([]);
    expect(inicios("2026-11-08")).toEqual([]);
  });

  it("feriado de un día: sin bloques", () => {
    const feriado = [{ desde: "2026-12-08", hasta: "2026-12-08", motivo: "Virgen de Caacupé" }];
    expect(bloquesDelDia("2026-12-08", HORARIO, 45, feriado)).toEqual([]);
    expect(bloquesDelDia("2026-12-09", HORARIO, 45, feriado)).toHaveLength(8);
  });

  it("vacaciones de varios días (cruzando el año): sin bloques en ningún día, ni en los bordes", () => {
    const vacaciones = [{ desde: "2026-12-21", hasta: "2027-01-08" }];
    for (const fecha of ["2026-12-21", "2026-12-28", "2027-01-04", "2027-01-08"]) {
      expect(bloquesDelDia(fecha, HORARIO, 45, vacaciones)).toEqual([]);
    }
    expect(bloquesDelDia("2026-12-18", HORARIO, 45, vacaciones)).toHaveLength(8);
    expect(bloquesDelDia("2027-01-11", HORARIO, 45, vacaciones)).toHaveLength(8);
  });

  it("los tramos desordenados salen en orden", () => {
    const desordenado: Tramo[] = [
      { dia_semana: 1, desde: "13:30", hasta: "14:15" },
      { dia_semana: 1, desde: "09:00", hasta: "09:45" },
    ];
    expect(inicios("2026-11-02", desordenado)).toEqual(["9:00", "13:30"]);
  });

  it("otra duración de bloque", () => {
    expect(inicios("2026-11-02", [{ dia_semana: 1, desde: "09:00", hasta: "11:00" }], 60)).toEqual(["9:00", "10:00"]);
  });

  it("duración inválida: sin bloques", () => {
    expect(inicios("2026-11-02", HORARIO, 0)).toEqual([]);
  });
});

describe("ayudas de horas y fechas", () => {
  it("convierte horas", () => {
    expect(aMinutos("09:05:00")).toBe(545);
    expect(aMinutos("9:05")).toBe(545);
    expect(aHora(545)).toBe("09:05");
    expect(horaCorta("09:00:00")).toBe("9:00");
    expect(horaCorta("13:30")).toBe("13:30");
  });

  it("día de la semana sin depender de la zona horaria", () => {
    expect(diaSemana("2026-11-02")).toBe(1);
    expect(diaSemana("2026-11-08")).toBe(0);
    expect(diaSemana("2027-01-01")).toBe(5);
  });

  it("encuentra el bloqueo del día", () => {
    const b = [{ desde: "2026-12-24", hasta: "2026-12-25", motivo: "Navidad" }];
    expect(bloqueoDelDia("2026-12-25", b)?.motivo).toBe("Navidad");
    expect(bloqueoDelDia("2026-12-26", b)).toBeNull();
  });
});
