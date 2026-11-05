import { describe, expect, it } from "vitest";
import type { Tramo } from "./bloques";
import { cortesDelDia, filasSemana, textoCorte } from "./semana";
import { armarDia } from "./turnos";

// Semana del lunes 2/11/2026. Datos inventados.
const LUNES = "2026-11-02";
const MARTES = "2026-11-03";
const MIERCOLES = "2026-11-04";

const partido = (dia: number, mananaHasta = "11:15", tardeDesde = "13:30"): Tramo[] => [
  { dia_semana: dia, desde: "09:00", hasta: mananaHasta },
  { dia_semana: dia, desde: tardeDesde, hasta: "17:15" },
];

const dias = (tramos: Tramo[], fechas: string[], bloqueos: { desde: string; hasta: string }[] = []) =>
  fechas.map((f) => armarDia(f, tramos, 45, bloqueos, []));

describe("cortesDelDia", () => {
  it("horario partido: un corte entre la mañana y la tarde", () => {
    expect(cortesDelDia(1, partido(1))).toEqual([{ desde: "11:15", hasta: "13:30" }]);
  });

  it("un solo tramo o un día sin horario: sin cortes", () => {
    expect(cortesDelDia(1, [{ dia_semana: 1, desde: "09:00", hasta: "17:00" }])).toEqual([]);
    expect(cortesDelDia(2, partido(1))).toEqual([]);
  });

  it("ordena los tramos y no cuenta como corte dos tramos pegados", () => {
    const tramos: Tramo[] = [
      { dia_semana: 1, desde: "14:00", hasta: "18:00" },
      { dia_semana: 1, desde: "08:00", hasta: "10:00" },
      { dia_semana: 1, desde: "10:00", hasta: "12:00" },
    ];
    expect(cortesDelDia(1, tramos)).toEqual([{ desde: "12:00", hasta: "14:00" }]);
  });

  it("acepta horas con segundos (como vienen de la base)", () => {
    const tramos: Tramo[] = [
      { dia_semana: 1, desde: "09:00:00", hasta: "12:00:00" },
      { dia_semana: 1, desde: "13:00:00", hasta: "17:00:00" },
    ];
    expect(cortesDelDia(1, tramos)).toEqual([{ desde: "12:00", hasta: "13:00" }]);
  });
});

describe("textoCorte", () => {
  it("al mediodía es Almuerzo; temprano o tarde, No disponible", () => {
    expect(textoCorte({ desde: "11:15", hasta: "13:30" })).toBe("Almuerzo");
    expect(textoCorte({ desde: "10:00", hasta: "10:30" })).toBe("No disponible");
    expect(textoCorte({ desde: "16:00", hasta: "16:30" })).toBe("No disponible");
  });
});

describe("filasSemana", () => {
  it("pone la franja entre la última hora de la mañana y la primera de la tarde", () => {
    const tramos = [...partido(1), ...partido(2)];
    const filas = filasSemana(dias(tramos, [LUNES, MARTES]), tramos);
    expect(filas.map((f) => (f.tipo === "hora" ? f.hora : f.texto))).toEqual([
      "09:00", "09:45", "10:30", "Almuerzo", "13:30", "14:15", "15:00", "15:45", "16:30",
    ]);
    expect(filas[3]).toEqual({ tipo: "corte", desde: "11:15", hasta: "13:30", texto: "Almuerzo", fechas: [LUNES, MARTES] });
  });

  it("almuerzos que se pisan en días distintos van en una sola franja, marcada solo en esos días", () => {
    const tramos = [...partido(1), ...partido(2, "12:00", "14:00"), { dia_semana: 3, desde: "09:00", hasta: "17:00" }];
    const filas = filasSemana(dias(tramos, [LUNES, MARTES, MIERCOLES]), tramos);
    const cortes = filas.filter((f) => f.tipo === "corte");
    expect(cortes).toEqual([{ tipo: "corte", desde: "11:15", hasta: "14:00", texto: "Almuerzo", fechas: [LUNES, MARTES] }]);
  });

  it("un feriado no lleva franja", () => {
    const tramos = [...partido(1), ...partido(2)];
    const filas = filasSemana(dias(tramos, [LUNES, MARTES], [{ desde: LUNES, hasta: LUNES }]), tramos);
    expect(filas.find((f) => f.tipo === "corte")).toMatchObject({ fechas: [MARTES] });
  });

  it("sin cortes: solo las horas; sin horas: nada", () => {
    const corrido: Tramo[] = [{ dia_semana: 1, desde: "09:00", hasta: "10:30" }];
    expect(filasSemana(dias(corrido, [LUNES]), corrido)).toEqual([
      { tipo: "hora", hora: "09:00" },
      { tipo: "hora", hora: "09:45" },
    ]);
    expect(filasSemana(dias(partido(1), [LUNES], [{ desde: LUNES, hasta: LUNES }]), partido(1))).toEqual([]);
  });

  it("un corte después de la última hora no se dibuja", () => {
    // La tarde empieza tan tarde que no entra ningún bloque de 45 min.
    const tramos: Tramo[] = [
      { dia_semana: 1, desde: "09:00", hasta: "10:30" },
      { dia_semana: 1, desde: "17:00", hasta: "17:30" },
    ];
    expect(filasSemana(dias(tramos, [LUNES]), tramos).some((f) => f.tipo === "corte")).toBe(false);
  });
});
