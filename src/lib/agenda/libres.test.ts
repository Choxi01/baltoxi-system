import { describe, expect, it } from "vitest";
import type { Bloqueo, Tramo } from "./bloques";
import {
  esDeManana,
  fechasDelPeriodo,
  libresPorDia,
  PLANTILLA_LIBRES_POR_DEFECTO,
  textoLibres,
  textoRango,
  type FiltrosLibres,
} from "./libres";
import { armarDia, type TurnoAgenda } from "./turnos";

// Horario inventado: lunes a viernes 9:00–11:15 y 13:30–15:00, bloques de 45 min.
// Bloques: 9:00, 9:45, 10:30, 13:30, 14:15.
const HORARIO: Tramo[] = [1, 2, 3, 4, 5].flatMap((d) => [
  { dia_semana: d, desde: "09:00", hasta: "11:15" },
  { dia_semana: d, desde: "13:30", hasta: "15:00" },
]);
const LUNES = "2026-11-02";
const MARTES = "2026-11-03";
const L_A_V = [1, 2, 3, 4, 5];

const turno = (fecha: string, inicio: string, estado: TurnoAgenda["estado"] = "agendado"): TurnoAgenda => ({
  id: `${fecha}-${inicio}`,
  clase: "turno",
  estado,
  fecha,
  inicio,
  fin: inicio === "09:00" ? "09:45" : inicio === "13:30" ? "14:15" : "11:15",
  titulo: "Paciente Inventado",
  tipo: "Sesión",
  serieId: null,
  tipoId: null,
  pacienteId: null,
  modalidad: "consultorio",
  porcentajeManual: null,
});
const dia = (fecha: string, turnos: TurnoAgenda[] = [], bloqueos: Bloqueo[] = []) => armarDia(fecha, HORARIO, 45, bloqueos, turnos);

const TODO: FiltrosLibres = { franja: "todo", desdeManana: false };
const ANTES_DE_ABRIR = { fecha: LUNES, hora: "07:00" };

describe("esDeManana (corte a las 12:00)", () => {
  it("antes de las 12:00 es mañana; desde las 12:00, tarde", () => {
    expect(esDeManana("08:00")).toBe(true);
    expect(esDeManana("11:59")).toBe(true);
    expect(esDeManana("11:30")).toBe(true); // aunque termine 12:15, empieza de mañana
    expect(esDeManana("12:00")).toBe(false);
    expect(esDeManana("13:30")).toBe(false);
  });
});

describe("libresPorDia", () => {
  it("devuelve las horas de inicio de los bloques sin turnos vivos", () => {
    const r = libresPorDia([dia(LUNES, [turno(LUNES, "09:00"), turno(LUNES, "13:30")])], TODO, ANTES_DE_ABRIR);
    expect(r).toEqual([{ fecha: LUNES, horas: ["09:45", "10:30", "14:15"] }]);
  });

  it("un turno cancelado deja el bloque libre", () => {
    const r = libresPorDia([dia(LUNES, [turno(LUNES, "09:00", "ausente_con_aviso")])], TODO, ANTES_DE_ABRIR);
    expect(r[0].horas).toContain("09:00");
  });

  it("solo mañana y solo tarde", () => {
    const d = [dia(LUNES)];
    expect(libresPorDia(d, { franja: "manana", desdeManana: false }, ANTES_DE_ABRIR)[0].horas).toEqual(["09:00", "09:45", "10:30"]);
    expect(libresPorDia(d, { franja: "tarde", desdeManana: false }, ANTES_DE_ABRIR)[0].horas).toEqual(["13:30", "14:15"]);
  });

  it("no muestra los horarios de hoy que ya empezaron", () => {
    const r = libresPorDia([dia(LUNES)], TODO, { fecha: LUNES, hora: "10:30" });
    expect(r[0].horas).toEqual(["13:30", "14:15"]);
  });

  it("no muestra días que ya pasaron", () => {
    const r = libresPorDia([dia(LUNES), dia(MARTES)], TODO, { fecha: MARTES, hora: "07:00" });
    expect(r.map((d) => d.fecha)).toEqual([MARTES]);
  });

  it("desde mañana: saca hoy entero", () => {
    const r = libresPorDia([dia(LUNES), dia(MARTES)], { franja: "todo", desdeManana: true }, ANTES_DE_ABRIR);
    expect(r.map((d) => d.fecha)).toEqual([MARTES]);
    expect(r[0].horas).toHaveLength(5);
  });

  it("un feriado no tiene libres", () => {
    const r = libresPorDia([dia(LUNES, [], [{ desde: LUNES, hasta: LUNES, motivo: "Feriado" }])], TODO, ANTES_DE_ABRIR);
    expect(r[0].horas).toEqual([]);
  });
});

describe("textoLibres", () => {
  it("arma una línea por día con la plantilla", () => {
    const texto = textoLibres(
      [
        { fecha: "2026-11-02", horas: ["10:30", "15:45"] },
        { fecha: "2026-11-03", horas: ["09:00", "16:30"] },
        { fecha: "2026-11-05", horas: ["13:30", "14:15"] },
      ],
      "esta semana",
      PLANTILLA_LIBRES_POR_DEFECTO,
    );
    expect(texto).toBe(
      "Horarios disponibles esta semana:\n• Lunes 2/11: 10:30, 15:45\n• Martes 3/11: 9:00, 16:30\n• Jueves 5/11: 13:30, 14:15",
    );
  });

  it("los días sin libres no aparecen", () => {
    const texto = textoLibres(
      [
        { fecha: "2026-11-02", horas: [] },
        { fecha: "2026-11-03", horas: ["09:00"] },
      ],
      "esta semana",
      PLANTILLA_LIBRES_POR_DEFECTO,
    );
    expect(texto).not.toContain("Lunes");
    expect(texto).toContain("• Martes 3/11: 9:00");
  });

  it("sin ningún libre: 'No tengo horarios libres {rango}'", () => {
    expect(textoLibres([], "hoy", PLANTILLA_LIBRES_POR_DEFECTO)).toBe("No tengo horarios libres hoy");
    expect(textoLibres([{ fecha: LUNES, horas: [] }], "este mes", PLANTILLA_LIBRES_POR_DEFECTO)).toBe("No tengo horarios libres este mes");
  });

  it("usa la plantilla del consultorio, y la de por defecto si viene vacía", () => {
    const libres = [{ fecha: LUNES, horas: ["09:00"] }];
    expect(textoLibres(libres, "hoy", "¡Hola! Tengo lugar {rango} ($):\n{libres}\nAvisame 🙂")).toBe(
      "¡Hola! Tengo lugar hoy ($):\n• Lunes 2/11: 9:00\nAvisame 🙂",
    );
    expect(textoLibres(libres, "hoy", "  ")).toBe("Horarios disponibles hoy:\n• Lunes 2/11: 9:00");
  });
});

describe("fechasDelPeriodo", () => {
  it("día, semana (días visibles) y mes", () => {
    expect(fechasDelPeriodo("dia", MARTES, L_A_V)).toEqual([MARTES]);
    expect(fechasDelPeriodo("semana", "2026-11-04", L_A_V)).toEqual(["2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06"]);
    const mes = fechasDelPeriodo("mes", "2026-11-15", L_A_V);
    expect(mes[0]).toBe("2026-11-01");
    expect(mes.at(-1)).toBe("2026-11-30");
  });
});

describe("textoRango", () => {
  const HOY = "2026-11-02";
  it("período actual: hoy, esta semana, este mes", () => {
    expect(textoRango("dia", HOY, HOY, L_A_V)).toBe("hoy");
    expect(textoRango("semana", "2026-11-05", HOY, L_A_V)).toBe("esta semana");
    expect(textoRango("mes", "2026-11-20", HOY, L_A_V)).toBe("este mes");
  });

  it("otro día", () => {
    expect(textoRango("dia", "2026-11-03", HOY, L_A_V)).toBe("mañana");
    expect(textoRango("dia", "2026-11-05", HOY, L_A_V)).toBe("el jueves 5/11");
  });

  it("otra semana, también entre dos meses", () => {
    expect(textoRango("semana", "2026-11-10", HOY, L_A_V)).toBe("la semana del 9 al 13/11");
    expect(textoRango("semana", "2026-12-01", HOY, L_A_V)).toBe("la semana del 30/11 al 4/12");
  });

  it("otro mes, con año si es otro año", () => {
    expect(textoRango("mes", "2026-12-10", HOY, L_A_V)).toBe("en diciembre");
    expect(textoRango("mes", "2027-01-10", "2026-12-20", L_A_V)).toBe("en enero de 2027");
  });
});
