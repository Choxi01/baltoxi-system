import { describe, expect, it } from "vitest";
import { avisosAlAgendar, horaFin, instanteUtc, partirNombre, textosAvisos, validarReserva } from "./reservas";
import type { TurnoAgenda } from "./turnos";

const FECHA = "2026-11-02";
const turno = (inicio: string, fin: string, datos: Partial<TurnoAgenda> = {}): TurnoAgenda => ({
  id: inicio,
  clase: "turno",
  estado: "agendado",
  fecha: FECHA,
  inicio,
  fin,
  titulo: "Ana Prueba",
  tipo: "Sesión",
  serieId: null,
  tipoId: null,
  pacienteId: null,
  modalidad: "consultorio",
  color: null,
  porcentajeManual: null,
  ...datos,
});
const nuevo = (inicio: string, fin: string, modalidad: string | null = "consultorio") => ({ fecha: FECHA, inicio, fin, modalidad });

describe("avisosAlAgendar: superposición", () => {
  it("avisa si ya hay un turno a esa hora", () => {
    const a = avisosAlAgendar(nuevo("09:00", "09:45"), [turno("09:00", "09:45")], 30);
    expect(a.superpuestos).toHaveLength(1);
  });

  it("turnos pegados no se pisan", () => {
    expect(avisosAlAgendar(nuevo("09:45", "10:30"), [turno("09:00", "09:45")], 30).superpuestos).toEqual([]);
  });

  it("reservado y ocupado también cuentan", () => {
    const a = avisosAlAgendar(nuevo("09:00", "09:45"), [turno("09:00", "09:45", { clase: "ocupado" })], 30);
    expect(a.superpuestos).toHaveLength(1);
  });

  it("un turno cancelado o reprogramado no cuenta, ni uno de otro día", () => {
    const turnos = [turno("09:00", "09:45", { estado: "cancelado_profesional" }), turno("09:00", "09:45", { fecha: "2026-11-03" })];
    expect(avisosAlAgendar(nuevo("09:00", "09:45"), turnos, 30).superpuestos).toEqual([]);
  });
});

describe("avisosAlAgendar: traslado", () => {
  it("domicilio pegado a uno del consultorio: avisa", () => {
    const a = avisosAlAgendar(nuevo("09:45", "10:30", "domicilio"), [turno("09:00", "09:45")], 30);
    expect(a.traslado).toHaveLength(1);
    expect(a.superpuestos).toEqual([]);
  });

  it("dos de domicilio con 15 minutos entre medio: avisa", () => {
    const a = avisosAlAgendar(nuevo("10:00", "10:45", "domicilio"), [turno("09:00", "09:45", { modalidad: "domicilio" })], 30);
    expect(a.traslado).toHaveLength(1);
  });

  it("con el tiempo justo de traslado o más: no avisa", () => {
    const a = avisosAlAgendar(nuevo("10:15", "11:00", "domicilio"), [turno("09:00", "09:45")], 30);
    expect(a.traslado).toEqual([]);
  });

  it("los dos en el consultorio: no avisa", () => {
    expect(avisosAlAgendar(nuevo("09:45", "10:30"), [turno("09:00", "09:45")], 30).traslado).toEqual([]);
  });

  it("online no necesita traslado", () => {
    expect(avisosAlAgendar(nuevo("09:45", "10:30", "online"), [turno("09:00", "09:45", { modalidad: "domicilio" })], 30).traslado).toEqual([]);
  });

  it("sin tipo de turno (reservado) cuenta como consultorio", () => {
    const a = avisosAlAgendar(nuevo("09:45", "10:30", null), [turno("09:00", "09:45", { modalidad: "domicilio" })], 30);
    expect(a.traslado).toHaveLength(1);
  });

  it("también avisa si el otro turno es después", () => {
    const a = avisosAlAgendar(nuevo("09:00", "09:45", "domicilio"), [turno("10:00", "10:45")], 30);
    expect(a.traslado).toHaveLength(1);
  });
});

describe("textosAvisos", () => {
  it("arma los textos para mostrar", () => {
    const t = textosAvisos({ superpuestos: [turno("09:00", "09:45")], traslado: [] }, 30);
    expect(t.superposicion).toBe("Ya hay un turno a esta hora: Ana Prueba (9:00). ¿Agendar igual?");
    expect(t.traslado).toBeNull();
    expect(textosAvisos({ superpuestos: [], traslado: [turno("13:30", "14:15", { clase: "reservado", titulo: "Fulano" })] }, 30).traslado).toBe(
      "Ojo con el traslado: quedan menos de 30 minutos con Reservado: Fulano (13:30).",
    );
  });
});

describe("horas", () => {
  it("día y hora de Asunción a UTC", () => {
    expect(instanteUtc("2026-11-02", "09:00")).toBe("2026-11-02T12:00:00.000Z");
    expect(instanteUtc("2026-11-02", "22:30")).toBe("2026-11-03T01:30:00.000Z");
  });

  it("hora de fin", () => {
    expect(horaFin("09:00", 45)).toBe("09:45");
    expect(horaFin("23:30", 45)).toBe("23:59");
  });
});

describe("validarReserva", () => {
  const base = { fecha: FECHA, inicio: "09:00", confirmado: false };
  const uuid = "6f1c9a52-3b7e-4d2a-9c1f-0a1b2c3d4e5f";

  it("turno con paciente y tipo", () => {
    expect(validarReserva({ ...base, clase: "turno", paciente_id: uuid, tipo_turno_id: uuid }).ok).toBe(true);
    expect(validarReserva({ ...base, clase: "turno", paciente_id: "x", tipo_turno_id: uuid }).ok).toBe(false);
  });

  it("reservado con nombre suelto (tipo opcional)", () => {
    expect(validarReserva({ ...base, clase: "reservado", nombre_reserva: " Fulano ", tipo_turno_id: null })).toEqual({
      ok: true,
      datos: { ...base, clase: "reservado", nombre_reserva: "Fulano", tipo_turno_id: null },
    });
    expect(validarReserva({ ...base, clase: "reservado", nombre_reserva: "  ", tipo_turno_id: null })).toEqual({ ok: false, error: "Escribí el nombre." });
  });

  it("ocupado con motivo", () => {
    expect(validarReserva({ ...base, clase: "ocupado", motivo_ocupado: "Reunión" }).ok).toBe(true);
    expect(validarReserva({ ...base, clase: "ocupado", motivo_ocupado: "" })).toEqual({ ok: false, error: "Escribí el motivo." });
  });

  it("rechaza fechas, horas o clases raras", () => {
    expect(validarReserva({ ...base, inicio: "9:00", clase: "ocupado", motivo_ocupado: "x" }).ok).toBe(false);
    expect(validarReserva({ ...base, clase: "otra" }).ok).toBe(false);
    expect(validarReserva(null).ok).toBe(false);
  });
});

describe("partirNombre", () => {
  it("primera palabra nombre, el resto apellido", () => {
    expect(partirNombre(" Fulano  de Prueba ")).toEqual({ nombre: "Fulano", apellido: "de Prueba" });
    expect(partirNombre("Fulano")).toEqual({ nombre: "Fulano", apellido: "" });
  });
});
