// Casos de prueba obligatorios de docs/reglas-cobro.md (uno por fila de la tabla).
// Datos inventados.

import { describe, expect, it } from "vitest";
import { clasificarCancelacion } from "./cancelacion";
import { calcularCargoTurno, montoBase } from "./cargo";
import { paraFacturar, type TutorFactura } from "./facturar";
import { montoPeriodo, rangoMes, rangoSemana } from "./periodo";
import { proyeccionMes, tasaAusenciasSinCobro } from "./reportes";
import { atraso, imputarPagos, vencimiento } from "./saldo";
import type { EstadoTurno, Paciente, Pago, ReglaCobro, Tarifa, TipoTurno, Turno } from "./tipos";

const tarifas: Tarifa[] = [
  { id: "regular", nombre: "Regular", monto_gs: 290000 },
  { id: "economica", nombre: "Económica", monto_gs: 280000 },
  { id: "domicilio", nombre: "Domicilio", monto_gs: 350000 },
  { id: "evaluacion", nombre: "Evaluación", monto_gs: 280000 },
];

const sesion: TipoTurno = { tarifa_id: null, genera_cobro: true, cobra_en_el_momento: false };
const aDomicilio: TipoTurno = { tarifa_id: "domicilio", genera_cobro: true, cobra_en_el_momento: false };
const entrevista: TipoTurno = { tarifa_id: "evaluacion", genera_cobro: true, cobra_en_el_momento: true };
const reunion: TipoTurno = { tarifa_id: null, genera_cobro: false, cobra_en_el_momento: false, requiere_paciente: false };

const reglas: ReglaCobro[] = [
  { estado: "presente", porcentaje: 100, paciente_id: null },
  { estado: "ausente_con_aviso", porcentaje: 0, paciente_id: null },
  { estado: "aviso_tardio", porcentaje: 100, paciente_id: null },
  { estado: "ausente_sin_aviso", porcentaje: 100, paciente_id: null },
  { estado: "cancelado_profesional", porcentaje: 0, paciente_id: null },
  { estado: "reprogramado", porcentaje: 0, paciente_id: null },
];

const HORAS_AVISO = 48;
const DIA_LIMITE = 10;

function paciente(datos: Partial<Paciente> = {}): Paciente {
  return {
    id: "pac-1",
    tarifa_id: "regular",
    monto_override_gs: null,
    responsable_pago_id: "tutor-1",
    plan_cobro: "mensual",
    ...datos,
  };
}

// Martes 10/11/2026 a las 15:00 en Asunción (UTC−3).
const INICIO = new Date("2026-11-10T15:00:00-03:00");
const horasAntes = (h: number) => new Date(INICIO.getTime() - h * 3_600_000);

function cobrar(
  estado: EstadoTurno,
  {
    pac = paciente(),
    tipo = sesion,
    inicio = INICIO,
    manual = null,
    lista = reglas,
    tarifasUsadas = tarifas,
  }: {
    pac?: Paciente;
    tipo?: TipoTurno;
    inicio?: Date;
    manual?: number | null;
    lista?: ReglaCobro[];
    tarifasUsadas?: Tarifa[];
  } = {},
) {
  const turno: Turno = {
    clase: "turno",
    estado,
    inicio,
    porcentaje_manual: manual,
    motivo_excepcion: manual == null ? null : "A criterio de la profesional",
  };
  return calcularCargoTurno({
    turno,
    tipoTurno: tipo,
    paciente: pac,
    montoBase: montoBase({ tipoTurno: tipo, paciente: pac, tarifas: tarifasUsadas }),
    reglas: lista,
  });
}

function cancelar(horas: number) {
  return clasificarCancelacion({ inicio: INICIO, avisoEn: horasAntes(horas), horasAvisoMinimas: HORAS_AVISO });
}

describe("casos de prueba obligatorios (reglas-cobro.md)", () => {
  it("caso 1: presente, tarifa regular → Gs. 290.000", () => {
    const cargo = cobrar("presente");
    expect(cargo?.monto).toBe(290000);
    expect(cargo?.snapshot).toEqual({
      tarifa: "Regular",
      monto_base: 290000,
      estado: "presente",
      porcentaje: 100,
      origen_regla: "consultorio",
    });
    expect(cargo?.fecha).toBe("2026-11-10");
    expect(cargo?.periodo).toBe("2026-11-01");
    expect(cargo?.tutor_id).toBe("tutor-1");
  });

  it("caso 2: canceló 72 h antes → ausente_con_aviso, Gs. 0", () => {
    const estado = cancelar(72);
    expect(estado).toBe("ausente_con_aviso");
    expect(cobrar(estado)?.monto).toBe(0);
  });

  it("caso 3: canceló exactamente 48 h antes → ausente_con_aviso, Gs. 0", () => {
    const estado = cancelar(48);
    expect(estado).toBe("ausente_con_aviso");
    expect(cobrar(estado)?.monto).toBe(0);
  });

  it("caso 4: canceló 47 h antes → aviso_tardio, Gs. 290.000", () => {
    const estado = cancelar(47);
    expect(estado).toBe("aviso_tardio");
    expect(cobrar(estado)?.monto).toBe(290000);
  });

  it("caso 5: canceló el mismo día, después de la hora → aviso_tardio, Gs. 290.000", () => {
    const estado = cancelar(-1);
    expect(estado).toBe("aviso_tardio");
    expect(cobrar(estado)?.monto).toBe(290000);
  });

  it("caso 6: sin aviso → Gs. 290.000", () => {
    expect(cobrar("ausente_sin_aviso")?.monto).toBe(290000);
  });

  it("caso 7: cancela la profesional → Gs. 0 (el turno queda para reponer)", () => {
    // `reponer = true` lo guarda la agenda al cancelar; acá se verifica que no se cobra.
    const cargo = cobrar("cancelado_profesional");
    expect(cargo?.monto).toBe(0);
    expect(cargo?.snapshot.estado).toBe("cancelado_profesional");
  });

  it("caso 8: sesión a domicilio aunque el paciente sea Económica → Gs. 350.000", () => {
    const cargo = cobrar("presente", { pac: paciente({ tarifa_id: "economica" }), tipo: aDomicilio });
    expect(cargo?.monto).toBe(350000);
    expect(cargo?.snapshot.tarifa).toBe("Domicilio");
  });

  it("caso 9: precio especial 250.000, sesión en consultorio → Gs. 250.000", () => {
    const cargo = cobrar("presente", { pac: paciente({ monto_override_gs: 250000 }) });
    expect(cargo?.monto).toBe(250000);
    expect(cargo?.snapshot.tarifa).toBe("precio especial");
  });

  it("caso 10: aviso tardío con excepción manual 0% → Gs. 0, origen 'manual'", () => {
    const cargo = cobrar("aviso_tardio", { manual: 0 });
    expect(cargo?.monto).toBe(0);
    expect(cargo?.snapshot.origen_regla).toBe("manual");
  });

  it("caso 11: excepción manual 50% con tarifa 285.555 → Gs. 142.778 (redondeo)", () => {
    const cargo = cobrar("presente", {
      manual: 50,
      tarifasUsadas: [{ id: "regular", nombre: "Regular", monto_gs: 285555 }],
    });
    expect(cargo?.monto).toBe(142778);
  });

  it("caso 12: reunión de equipo (no genera cobro) → null", () => {
    expect(cobrar("presente", { tipo: reunion })).toBeNull();
  });

  it("caso 13: turno agendado → null", () => {
    expect(cobrar("agendado")).toBeNull();
  });

  it("caso 14: falta la regla del estado → error", () => {
    const sinPresente = reglas.filter((r) => r.estado !== "presente");
    expect(() => cobrar("presente", { lista: sinPresente })).toThrow(/Falta la regla/);
  });

  it("caso 15: FIFO, cargos sep 580.000 y oct 870.000, pago 1.000.000", () => {
    const filas = imputarPagos({
      cargos: [
        { id: "oct", fecha: "2026-10-15", monto_gs: 870000 },
        { id: "sep", fecha: "2026-09-15", monto_gs: 580000 },
      ],
      pagos: [{ id: "pago-1", fecha: "2026-10-20", monto_gs: 1000000 }],
    });
    expect(filas).toEqual([
      { cargo_id: "sep", pagado: 580000, pendiente: 0, pagos: [{ pago_id: "pago-1", monto: 580000 }] },
      { cargo_id: "oct", pagado: 420000, pendiente: 450000, pagos: [{ pago_id: "pago-1", monto: 420000 }] },
    ]);
  });

  const cargoOctubre = {
    vencimiento: vencimiento({ fecha: "2026-10-15", plan: "mensual", cobraEnElMomento: false, diaLimitePago: DIA_LIMITE }),
    pendiente: 290000,
  };

  it("caso 16: plan mensual, cargo de octubre impago, hoy 11/11 → en atraso, 1 día", () => {
    expect(cargoOctubre.vencimiento).toBe("2026-11-10");
    expect(atraso({ cargos: [cargoOctubre], hoy: "2026-11-11" })).toEqual({ enAtraso: true, dias: 1 });
  });

  it("caso 17: mismo caso, hoy 10/11 → sin atraso", () => {
    expect(atraso({ cargos: [cargoOctubre], hoy: "2026-11-10" })).toEqual({ enAtraso: false, dias: 0 });
  });

  it("caso 18: entrevista (cobra en el momento), plan mensual, impaga al día siguiente → en atraso", () => {
    const cargo = cobrar("presente", { tipo: entrevista, inicio: new Date("2026-11-03T09:00:00-03:00") });
    expect(cargo?.monto).toBe(280000);
    const vence = vencimiento({
      fecha: cargo!.fecha,
      plan: "mensual",
      cobraEnElMomento: entrevista.cobra_en_el_momento,
      diaLimitePago: DIA_LIMITE,
    });
    expect(vence).toBe("2026-11-03");
    expect(atraso({ cargos: [{ vencimiento: vence, pendiente: cargo!.monto }], hoy: "2026-11-04" }).enAtraso).toBe(true);
  });

  it("caso 19: factura de noviembre con pagos que cubren septiembre y octubre", () => {
    const cargos = [
      { id: "sep", tutor_id: "tutor-1", fecha: "2026-09-15", monto_gs: 580000 },
      { id: "oct", tutor_id: "tutor-1", fecha: "2026-10-15", monto_gs: 870000 },
    ];
    const pagos: Pago[] = [
      { id: "pago-1", tutor_id: "tutor-1", fecha: "2026-11-01", monto_gs: 580000, medio: "transferencia", factura_id: null },
      { id: "pago-2", tutor_id: "tutor-1", fecha: "2026-11-05", monto_gs: 870000, medio: "efectivo", factura_id: null },
    ];
    const tutor: TutorFactura = {
      id: "tutor-1",
      nombre: "Ana",
      apellido: "Prueba",
      email: "ana@ejemplo.com",
      doc_tipo: "RUC",
      doc_numero: "1234567",
      dv: "8",
      razon_social: null,
    };
    const filas = paraFacturar({
      mes: "2026-11-01",
      pagos,
      imputacion: imputarPagos({ cargos, pagos }),
      cargos,
      tutores: [tutor],
      conceptoFactura: "Servicios de fonoaudiología",
    });
    expect(filas).toHaveLength(1);
    expect(filas[0]).toMatchObject({
      monto: 1450000,
      iva: 131818,
      concepto: "Servicios de fonoaudiología – sesiones de septiembre y octubre 2026",
      documento: "1234567-8",
      razon_social: "Ana Prueba",
      medios: ["transferencia", "efectivo"],
      pago_ids: ["pago-1", "pago-2"],
    });
  });

  it("caso 20: monto semanal, 2 sesiones presentes lun y jue, ya pagó 290.000 → Gs. 290.000", () => {
    const lunes = cobrar("presente", { inicio: new Date("2026-11-09T15:00:00-03:00") })!;
    const jueves = cobrar("presente", { inicio: new Date("2026-11-12T15:00:00-03:00") })!;
    const cargos = [
      { id: "lun", fecha: lunes.fecha, monto_gs: lunes.monto },
      { id: "jue", fecha: jueves.fecha, monto_gs: jueves.monto },
    ];
    const imputacion = imputarPagos({ cargos, pagos: [{ id: "pago-1", fecha: "2026-11-12", monto_gs: 290000 }] });
    expect(montoPeriodo({ cargos, imputacion, ...rangoSemana("2026-11-12") })).toBe(290000);
  });

  it("caso 21: proyección, generado 2.900.000, quedan 5 turnos regulares, tasa 10% → Gs. 4.205.000", () => {
    const historia = Array.from({ length: 20 }, (_, i) => ({
      estado: (i < 2 ? "ausente_con_aviso" : "presente") as EstadoTurno,
      monto_cargo: i < 2 ? 0 : 290000,
    }));
    const tasa = tasaAusenciasSinCobro(historia);
    expect(tasa).toBeCloseTo(0.1);
    expect(proyeccionMes({ generado: 2900000, montosBaseAgendados: Array(5).fill(290000), tasa })).toBe(4205000);
  });

  it("caso 22: dos hermanos con el mismo tutor → el monto del mes suma los dos", () => {
    const hermano1 = cobrar("presente", { pac: paciente({ id: "pac-1" }) })!;
    const hermano2 = cobrar("presente", {
      pac: paciente({ id: "pac-2", tarifa_id: "economica" }),
      inicio: new Date("2026-11-17T16:00:00-03:00"),
    })!;
    expect(hermano1.tutor_id).toBe(hermano2.tutor_id);
    const cargos = [
      { id: "c1", fecha: hermano1.fecha, monto_gs: hermano1.monto },
      { id: "c2", fecha: hermano2.fecha, monto_gs: hermano2.monto },
    ];
    const imputacion = imputarPagos({ cargos, pagos: [] });
    expect(montoPeriodo({ cargos, imputacion, ...rangoMes("2026-11-10") })).toBe(570000);
  });
});
