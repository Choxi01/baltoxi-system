import { describe, expect, it } from "vitest";
import type { Tramo } from "./bloques";
import { aHoraLocal, armarDia, inicioDelDiaUtc, liberaBloque, textoTurno, type TurnoAgenda } from "./turnos";

const HORARIO: Tramo[] = [1, 2, 3, 4, 5].flatMap((d) => [
  { dia_semana: d, desde: "09:00", hasta: "11:15" },
  { dia_semana: d, desde: "13:30", hasta: "17:15" },
]);
const LUNES = "2026-11-02";

let n = 0;
const turno = (inicio: string, datos: Partial<TurnoAgenda> = {}): TurnoAgenda => {
  const [h, m] = inicio.split(":").map(Number);
  const fin = h * 60 + m + 45;
  return {
    id: `t${n++}`,
    clase: "turno",
    estado: "agendado",
    fecha: LUNES,
    inicio,
    fin: `${String(Math.floor(fin / 60)).padStart(2, "0")}:${String(fin % 60).padStart(2, "0")}`,
    titulo: "Paciente Prueba",
    tipo: "Sesión",
    serieId: null,
    tipoId: null,
    pacienteId: null,
    modalidad: "consultorio",
    ...datos,
  };
};
const dia = (turnos: TurnoAgenda[], fecha = LUNES, bloqueos = []) => armarDia(fecha, HORARIO, 45, bloqueos, turnos);

describe("liberaBloque", () => {
  it("cancelados y reprogramados liberan; agendado, vino y no vino, no", () => {
    for (const e of ["ausente_con_aviso", "aviso_tardio", "cancelado_profesional", "reprogramado"]) expect(liberaBloque(e)).toBe(true);
    for (const e of ["agendado", "presente", "ausente_sin_aviso"]) expect(liberaBloque(e)).toBe(false);
  });
});

describe("armarDia", () => {
  it("sin turnos: los 8 bloques libres", () => {
    const d = dia([]);
    expect(d.libres).toBe(8);
    expect(d.filas.every((f) => f.tipo === "bloque" && f.turnos.length === 0)).toBe(true);
  });

  it("un turno ocupa su bloque", () => {
    const d = dia([turno("09:45")]);
    expect(d.libres).toBe(7);
    expect(d.filas[1]).toMatchObject({ tipo: "bloque", inicio: "09:45", turnos: [{ inicio: "09:45" }] });
  });

  it("reservado y ocupado también ocupan el bloque", () => {
    const d = dia([turno("13:30", { clase: "reservado" }), turno("14:15", { clase: "ocupado" })]);
    expect(d.libres).toBe(6);
  });

  it("un turno cancelado libera el bloque pero queda a la vista", () => {
    const d = dia([turno("09:00", { estado: "ausente_con_aviso" })]);
    expect(d.libres).toBe(8);
    expect(d.filas[0]).toMatchObject({ turnos: [], liberados: [{ estado: "ausente_con_aviso" }] });
  });

  it("vino y no vino no liberan", () => {
    expect(dia([turno("09:00", { estado: "presente" }), turno("09:45", { estado: "ausente_sin_aviso" })]).libres).toBe(6);
  });

  it("dos turnos en el mismo bloque: aparecen los dos", () => {
    const d = dia([turno("10:30"), turno("10:30", { titulo: "Otro" })]);
    expect(d.filas[2]).toMatchObject({ turnos: [{}, { titulo: "Otro" }] });
    expect(d.libres).toBe(7);
  });

  it("un turno corrido ocupa los dos bloques que pisa", () => {
    const d = dia([turno("10:00")]); // 10:00–10:45 pisa 9:45 y 10:30
    expect(d.libres).toBe(6);
  });

  it("turno fuera de horario: fila aparte, ordenada por hora", () => {
    const d = dia([turno("12:00")]);
    expect(d.libres).toBe(8);
    const i = d.filas.findIndex((f) => f.tipo === "fuera");
    expect(d.filas[i]).toMatchObject({ tipo: "fuera", inicio: "12:00" });
    expect(d.filas[i - 1].inicio).toBe("10:30");
    expect(d.filas[i + 1].inicio).toBe("13:30");
  });

  it("feriado: sin bloques, con el motivo; un turno vivo ese día se muestra igual", () => {
    const feriado = [{ desde: LUNES, hasta: LUNES, motivo: "Feriado de prueba" }];
    const d = dia([turno("09:00")], LUNES, feriado as never);
    expect(d.bloqueo?.motivo).toBe("Feriado de prueba");
    expect(d.libres).toBe(0);
    expect(d.filas).toEqual([expect.objectContaining({ tipo: "fuera" })]);
  });

  it("solo cuenta los turnos de esa fecha", () => {
    expect(dia([turno("09:00", { fecha: "2026-11-03" })]).libres).toBe(8);
  });

  it("un turno cancelado fuera de horario no aparece", () => {
    expect(dia([turno("12:00", { estado: "reprogramado" })]).filas.some((f) => f.tipo === "fuera")).toBe(false);
  });
});

describe("horas en Asunción", () => {
  it("convierte el instante de la base a fecha y hora de Asunción", () => {
    // Asunción es UTC−3: 12:00 UTC = 9:00 en Asunción.
    expect(aHoraLocal("2026-11-02T12:00:00Z")).toEqual({ fecha: "2026-11-02", hora: "09:00" });
    // 01:30 UTC del 3 = 22:30 del 2 en Asunción.
    expect(aHoraLocal("2026-11-03T01:30:00+00:00")).toEqual({ fecha: "2026-11-02", hora: "22:30" });
  });

  it("comienzo del día de Asunción en UTC", () => {
    expect(inicioDelDiaUtc("2026-11-02")).toBe("2026-11-02T03:00:00.000Z");
  });
});

describe("textoTurno", () => {
  it("reservado y ocupado llevan su prefijo", () => {
    expect(textoTurno({ clase: "turno", titulo: "Ana" })).toBe("Ana");
    expect(textoTurno({ clase: "reservado", titulo: "Fulano" })).toBe("Reservado: Fulano");
    expect(textoTurno({ clase: "ocupado", titulo: "Reunión" })).toBe("Ocupado: Reunión");
  });
});
