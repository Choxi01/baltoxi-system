import { describe, expect, it } from "vitest";
import { copiarDia, horaDeBase, proximosBloqueos, textoBloqueo, validarBloqueo, validarHorario } from "./horario";

const lunes = (desde: string, hasta: string) => ({ dia_semana: 1, desde, hasta });

describe("validarHorario", () => {
  it("acepta el horario partido", () => {
    const r = validarHorario({ duracion: 45, tramos: [lunes("09:00", "11:15"), lunes("13:30", "17:15")] });
    expect(r.ok).toBe(true);
  });

  it("acepta un día sin tramos (no atiende)", () => {
    expect(validarHorario({ duracion: 45, tramos: [] }).ok).toBe(true);
  });

  it('"hasta" tiene que ser mayor que "desde"', () => {
    const r = validarHorario({ duracion: 45, tramos: [lunes("11:00", "09:00")] });
    expect(r).toMatchObject({ ok: false, porDia: { 1: expect.stringMatching(/Lunes.*después/) } });
    expect(validarHorario({ duracion: 45, tramos: [lunes("09:00", "09:00")] }).ok).toBe(false);
  });

  it("los tramos de un mismo día no se pueden pisar", () => {
    const r = validarHorario({ duracion: 45, tramos: [lunes("13:30", "17:00"), lunes("09:00", "14:00")] });
    expect(r).toMatchObject({ ok: false, porDia: { 1: "Lunes: los tramos 09:00–14:00 y 13:30–17:00 se pisan." } });
  });

  it("tramos pegados sí se aceptan, y en días distintos no se cruzan", () => {
    expect(validarHorario({ duracion: 45, tramos: [lunes("09:00", "12:00"), lunes("12:00", "13:00")] }).ok).toBe(true);
    const r = validarHorario({ duracion: 45, tramos: [lunes("09:00", "12:00"), { dia_semana: 2, desde: "10:00", hasta: "11:00" }] });
    expect(r.ok).toBe(true);
  });

  it("rechaza horas o duraciones raras", () => {
    expect(validarHorario({ duracion: 45, tramos: [lunes("9", "10:00")] }).ok).toBe(false);
    expect(validarHorario({ duracion: 0, tramos: [] }).ok).toBe(false);
    expect(validarHorario({ duracion: 45.5, tramos: [] }).ok).toBe(false);
    expect(validarHorario(null).ok).toBe(false);
  });
});

describe("copiarDia", () => {
  const crear = (t: { dia_semana: number; desde: string; hasta: string }) => ({ ...t });

  it("copia los tramos del lunes al martes y miércoles, reemplazando lo que tenían", () => {
    const tramos = [lunes("09:00", "11:15"), lunes("13:30", "17:15"), { dia_semana: 2, desde: "08:00", hasta: "09:00" }];
    const r = copiarDia(tramos, 1, [2, 3], crear);
    expect(r.filter((t) => t.dia_semana === 2)).toEqual([
      { dia_semana: 2, desde: "09:00", hasta: "11:15" },
      { dia_semana: 2, desde: "13:30", hasta: "17:15" },
    ]);
    expect(r.filter((t) => t.dia_semana === 3)).toHaveLength(2);
    expect(r.filter((t) => t.dia_semana === 1)).toHaveLength(2);
  });

  it("copiar un día vacío deja vacíos los destinos; el origen no se toca", () => {
    const r = copiarDia([lunes("09:00", "10:00")], 6, [1, 6], crear);
    expect(r).toEqual([]);
  });
});

describe("validarBloqueo", () => {
  const campos = (desde: [string, string, string], hasta: [string, string, string] = ["", "", ""], motivo = "") => ({
    desde_dia: desde[0], desde_mes: desde[1], desde_anio: desde[2],
    hasta_dia: hasta[0], hasta_mes: hasta[1], hasta_anio: hasta[2],
    motivo,
  });

  it("un feriado de un día: sin hasta", () => {
    expect(validarBloqueo(campos(["8", "12", "2026"], undefined, " Caacupé "))).toEqual({
      ok: true,
      datos: { desde: "2026-12-08", hasta: "2026-12-08", motivo: "Caacupé" },
    });
  });

  it("vacaciones de varios días", () => {
    expect(validarBloqueo(campos(["21", "12", "2026"], ["8", "1", "2027"]))).toEqual({
      ok: true,
      datos: { desde: "2026-12-21", hasta: "2027-01-08", motivo: null },
    });
  });

  it("hasta antes que desde: error", () => {
    expect(validarBloqueo(campos(["21", "12", "2026"], ["20", "12", "2026"]))).toMatchObject({ ok: false, errores: { hasta: expect.any(String) } });
  });

  it("sin desde o con fechas imposibles: error", () => {
    expect(validarBloqueo(campos(["", "", ""]))).toMatchObject({ ok: false, errores: { desde: "Elegí la fecha." } });
    expect(validarBloqueo(campos(["31", "2", "2026"]))).toMatchObject({ ok: false, errores: { desde: "Esa fecha no existe." } });
    expect(validarBloqueo(campos(["1", "2", "2026"], ["1", "", "2026"]))).toMatchObject({ ok: false, errores: { hasta: expect.any(String) } });
  });

  it("motivo demasiado largo", () => {
    expect(validarBloqueo(campos(["1", "2", "2026"], undefined, "x".repeat(101)))).toMatchObject({ ok: false, errores: { motivo: expect.any(String) } });
  });
});

describe("textos y listas", () => {
  it("texto del bloqueo", () => {
    expect(textoBloqueo({ desde: "2026-12-08", hasta: "2026-12-08" })).toBe("8 de diciembre de 2026");
    expect(textoBloqueo({ desde: "2026-12-21", hasta: "2027-01-08" })).toBe("Del 21 de diciembre de 2026 al 8 de enero de 2027");
  });

  it("próximos: los que no terminaron, ordenados", () => {
    const lista = [
      { desde: "2026-12-21", hasta: "2027-01-08" },
      { desde: "2026-10-01", hasta: "2026-10-02" },
      { desde: "2026-10-28", hasta: "2026-10-30" },
    ];
    expect(proximosBloqueos(lista, "2026-10-29").map((b) => b.desde)).toEqual(["2026-10-28", "2026-12-21"]);
  });

  it("hora de la base", () => {
    expect(horaDeBase("09:00:00")).toBe("09:00");
  });
});
