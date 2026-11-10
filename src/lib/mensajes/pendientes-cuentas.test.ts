import { describe, expect, it } from "vitest";

import { saldo } from "@/lib/cobro/saldo";
import { pendientesDelDia, tutoresConCuentaNecesaria, type CargoPendientes, type DatosPendientes, type PagoPendientes, type TurnoPendientes } from "./pendientes";
import { PLANTILLAS_POR_DEFECTO } from "./plantillas";

// Datos inventados (regla de oro 8).
let n = 0;
const turno = (paciente_id: string, fecha: string, estado = "agendado"): TurnoPendientes => ({
  id: `turno-${++n}`,
  clase: "turno",
  estado,
  paciente_id,
  fecha,
  hora: "15:00",
});
const cargo = (tutor_id: string, paciente_id: string | null, fecha: string, monto_gs: number, cobra_en_el_momento = false): CargoPendientes => ({
  id: `cargo-${++n}`,
  tutor_id,
  paciente_id,
  fecha,
  monto_gs,
  cobra_en_el_momento,
  estado: "presente",
  tipo: "Sesión",
});
const pago = (tutor_id: string, fecha: string, monto_gs: number): PagoPendientes => ({ id: `pago-${++n}`, tutor_id, fecha, monto_gs });

const TUTORES = ["alDia", "debe", "aFavor", "ajuste", "exResponsable", "semanal", "sinNada"];

const completos: DatosPendientes = {
  plantillas: { ...PLANTILLAS_POR_DEFECTO },
  datosPago: "Alias 0000000",
  diaLimitePago: 10,
  horasAvisoMinimas: 24,
  tramos: [1, 2, 3, 4, 5].map((dia_semana) => ({ dia_semana })),
  bloqueos: [],
  tutores: TUTORES.map((id) => ({ id, nombre: `Tutor ${id}`, apellido: "Prueba", telefono_wa: "595981000001" })),
  pacientes: [
    { id: "p-alDia", nombre: "Ana", responsable_pago_id: "alDia", plan_cobro: "mensual" },
    { id: "p-debe", nombre: "Beto", responsable_pago_id: "debe", plan_cobro: "mensual" },
    { id: "p-aFavor", nombre: "Caro", responsable_pago_id: "aFavor", plan_cobro: "mensual" },
    { id: "p-ajuste", nombre: "Dani", responsable_pago_id: "ajuste", plan_cobro: "por_sesion" },
    // Cambió de responsable: la deuda vieja queda en exResponsable, sin turnos a su nombre.
    { id: "p-movido", nombre: "Eli", responsable_pago_id: "alDia", plan_cobro: "mensual" },
    { id: "p-semanal", nombre: "Fede", responsable_pago_id: "semanal", plan_cobro: "semanal" },
  ],
  turnos: [
    turno("p-alDia", "2026-11-13", "presente"),
    turno("p-alDia", "2026-11-27"),
    turno("p-debe", "2026-11-20"),
    turno("p-aFavor", "2026-11-27"),
    turno("p-ajuste", "2026-11-18"),
    turno("p-movido", "2026-11-25"),
    turno("p-semanal", "2026-11-06", "presente"),
    turno("p-semanal", "2026-11-13"),
    turno("p-semanal", "2026-11-20"),
  ],
  cargos: [
    cargo("alDia", "p-alDia", "2026-09-10", 290000),
    cargo("alDia", "p-alDia", "2026-11-13", 290000),
    cargo("debe", "p-debe", "2026-08-10", 290000),
    cargo("debe", "p-debe", "2026-09-10", 290000),
    cargo("aFavor", "p-aFavor", "2026-10-10", 290000),
    cargo("ajuste", "p-ajuste", "2026-10-10", 290000),
    cargo("ajuste", null, "2026-10-11", -290000),
    cargo("exResponsable", "p-movido", "2026-07-10", 280000),
    cargo("semanal", "p-semanal", "2026-11-06", 290000, true),
  ],
  pagos: [pago("alDia", "2026-10-05", 580000), pago("debe", "2026-09-15", 100000), pago("aFavor", "2026-10-20", 500000)],
  enviados: [],
};

/** Lo mismo que hace obtenerDatosPendientes: lee solo las cuentas de los tutores necesarios. */
function recortados(hoy: string) {
  const saldos = TUTORES.map((id) => ({
    tutor_id: id,
    saldo_gs: saldo({ cargos: completos.cargos.filter((c) => c.tutor_id === id), pagos: completos.pagos.filter((p) => p.tutor_id === id) }),
  }));
  const ids = tutoresConCuentaNecesaria(hoy, { saldos, turnos: completos.turnos, pacientes: completos.pacientes });
  return {
    ...completos,
    cargos: completos.cargos.filter((c) => ids.includes(c.tutor_id)),
    pagos: completos.pagos.filter((p) => ids.includes(p.tutor_id)),
  };
}

const diasDeNoviembre = Array.from({ length: 30 }, (_, i) => `2026-11-${String(i + 1).padStart(2, "0")}`);

describe("tutoresConCuentaNecesaria", () => {
  const pacientes = [{ id: "p1", responsable_pago_id: "t1" }];

  it("incluye a quien debe y deja afuera saldo 0 o a favor", () => {
    const saldos = [
      { tutor_id: "debe", saldo_gs: 1 },
      { tutor_id: "cero", saldo_gs: 0 },
      { tutor_id: "favor", saldo_gs: -1 },
    ];
    expect(tutoresConCuentaNecesaria("2026-11-10", { saldos, turnos: [], pacientes })).toEqual(["debe"]);
  });

  it("incluye al responsable de un turno de hoy, no de otro día", () => {
    const saldos = [{ tutor_id: "t1", saldo_gs: 0 }];
    expect(tutoresConCuentaNecesaria("2026-11-10", { saldos, turnos: [{ paciente_id: "p1", fecha: "2026-11-10" }], pacientes })).toEqual(["t1"]);
    expect(tutoresConCuentaNecesaria("2026-11-10", { saldos, turnos: [{ paciente_id: "p1", fecha: "2026-11-11" }], pacientes })).toEqual([]);
  });

  it("un bloque sin paciente o un paciente sin responsable no suman a nadie", () => {
    const turnos = [
      { paciente_id: null, fecha: "2026-11-10" },
      { paciente_id: "sin", fecha: "2026-11-10" },
    ];
    expect(tutoresConCuentaNecesaria("2026-11-10", { saldos: [], turnos, pacientes: [{ id: "sin", responsable_pago_id: null }] })).toEqual([]);
  });
});

describe("leer solo las cuentas necesarias no cambia los mensajes", () => {
  it.each(diasDeNoviembre)("%s", (hoy) => {
    expect(pendientesDelDia(hoy, recortados(hoy))).toEqual(pendientesDelDia(hoy, completos));
  });

  it("la prueba compara mensajes de verdad y lee menos datos", () => {
    const resultados = diasDeNoviembre.map((hoy) => pendientesDelDia(hoy, completos));
    expect(resultados.some((r) => r.pagos.length > 0)).toBe(true);
    expect(resultados.some((r) => r.montos.length > 0)).toBe(true);
    expect(recortados("2026-11-10").cargos.length).toBeLessThan(completos.cargos.length);
    expect(recortados("2026-11-10").pagos.length).toBeLessThan(completos.pagos.length);
  });
});
