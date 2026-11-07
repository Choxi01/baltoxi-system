import { describe, expect, it } from "vitest";
import { separarTurnos, textoAsistencia, type TurnoPaciente } from "./turnos";

// Datos inventados (regla de oro 8).
let n = 0;
const turno = (fecha: string, hora: string, estado = "agendado"): TurnoPaciente => ({ id: `t${++n}`, estado, fecha, hora, tipo: "Sesión" });
const AHORA = { fecha: "2026-11-06", hora: "15:00" };
const fechas = (lista: TurnoPaciente[]) => lista.map((t) => `${t.fecha} ${t.hora}`);

describe("separarTurnos", () => {
  it("próximos: el más cercano primero", () => {
    const { proximos } = separarTurnos([turno("2026-11-20", "09:00"), turno("2026-11-09", "15:00"), turno("2026-11-09", "09:00")], AHORA);
    expect(fechas(proximos)).toEqual(["2026-11-09 09:00", "2026-11-09 15:00", "2026-11-20 09:00"]);
  });

  it("historial: lo más nuevo arriba", () => {
    const { historial } = separarTurnos([turno("2026-10-02", "09:00", "presente"), turno("2026-10-30", "09:00", "ausente_sin_aviso")], AHORA);
    expect(fechas(historial)).toEqual(["2026-10-30 09:00", "2026-10-02 09:00"]);
  });

  it("hoy: depende de la hora", () => {
    const r = separarTurnos([turno("2026-11-06", "15:00"), turno("2026-11-06", "14:15")], AHORA);
    expect(fechas(r.proximos)).toEqual(["2026-11-06 15:00"]);
    expect(fechas(r.historial)).toEqual(["2026-11-06 14:15"]);
  });

  it("un agendado que ya pasó va al historial", () => {
    const r = separarTurnos([turno("2026-11-02", "09:00")], AHORA);
    expect(r.proximos).toEqual([]);
    expect(r.historial).toHaveLength(1);
  });

  it("uno futuro ya cancelado va al historial, no a próximos", () => {
    const r = separarTurnos([turno("2026-11-20", "09:00", "ausente_con_aviso")], AHORA);
    expect(r.proximos).toEqual([]);
    expect(r.historial).toHaveLength(1);
  });
});

describe("textoAsistencia", () => {
  it("usa los nombres de la agenda", () => {
    expect(textoAsistencia("presente")).toBe("Vino");
    expect(textoAsistencia("aviso_tardio")).toBe("Canceló tarde");
  });

  it("agendado en el historial: sin marcar", () => {
    expect(textoAsistencia("agendado")).toBe("Sin marcar");
  });
});
