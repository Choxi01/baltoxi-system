// Bordes del motor de cobro que no están en la tabla de casos. Datos inventados.

import { describe, expect, it } from "vitest";
import { clasificarCancelacion } from "./cancelacion";
import { calcularCargoTurno, montoBase, porcentajeAplicable } from "./cargo";
import { documentoTutor, textoMeses } from "./facturar";
import { iva10 } from "./formato";
import { rangoMes, rangoSemana } from "./periodo";
import { horasTrabajadas, tasaAusenciasSinCobro } from "./reportes";
import { atraso, imputarPagos, saldo, vencimiento } from "./saldo";
import type { ReglaCobro } from "./tipos";

describe("iva10", () => {
  it("redondea el IVA incluido", () => {
    expect(iva10(1450000)).toBe(131818);
    expect(iva10(290000)).toBe(26364);
    expect(iva10(0)).toBe(0);
  });
  it("no acepta decimales", () => {
    expect(() => iva10(10.5)).toThrow();
  });
});

describe("montoBase y porcentaje", () => {
  const tarifas = [{ id: "r", nombre: "Regular", monto_gs: 290000 }, { id: "d", nombre: "Domicilio", monto_gs: 350000 }];

  it("la tarifa del tipo gana al precio especial", () => {
    expect(montoBase({ tipoTurno: { tarifa_id: "d" }, paciente: { tarifa_id: "r", monto_override_gs: 250000 }, tarifas }))
      .toEqual({ monto: 350000, tarifa: "Domicilio" });
  });

  it("precio especial en 0 se respeta (no cae a la tarifa)", () => {
    expect(montoBase({ tipoTurno: { tarifa_id: null }, paciente: { tarifa_id: "r", monto_override_gs: 0 }, tarifas }).monto).toBe(0);
  });

  it("error si falta la tarifa", () => {
    expect(() => montoBase({ tipoTurno: { tarifa_id: null }, paciente: { tarifa_id: null, monto_override_gs: null }, tarifas })).toThrow();
  });

  it("la regla del paciente gana a la del consultorio", () => {
    const reglas: ReglaCobro[] = [
      { estado: "aviso_tardio", porcentaje: 100, paciente_id: null },
      { estado: "aviso_tardio", porcentaje: 50, paciente_id: "p1" },
    ];
    expect(porcentajeAplicable({ turno: { estado: "aviso_tardio", porcentaje_manual: null }, pacienteId: "p1", reglas }))
      .toEqual({ porcentaje: 50, origen: "paciente" });
    expect(porcentajeAplicable({ turno: { estado: "aviso_tardio", porcentaje_manual: null }, pacienteId: "p2", reglas }))
      .toEqual({ porcentaje: 100, origen: "consultorio" });
  });

  it("la fecha del cargo es el día en Asunción (turno tarde a fin de mes)", () => {
    const cargo = calcularCargoTurno({
      turno: { clase: "turno", estado: "presente", inicio: "2026-12-01T02:30:00Z", porcentaje_manual: null },
      tipoTurno: { genera_cobro: true },
      paciente: { id: "p1", responsable_pago_id: "t1" },
      montoBase: { monto: 290000, tarifa: "Regular" },
      reglas: [{ estado: "presente", porcentaje: 100, paciente_id: null }],
    });
    expect(cargo?.fecha).toBe("2026-11-30");
    expect(cargo?.periodo).toBe("2026-11-01");
  });

  it("bloques reservados u ocupados no generan cargo", () => {
    const base = {
      tipoTurno: { genera_cobro: true },
      paciente: { id: "p1", responsable_pago_id: "t1" },
      montoBase: { monto: 290000, tarifa: "Regular" },
      reglas: [{ estado: "presente" as const, porcentaje: 100, paciente_id: null }],
    };
    expect(calcularCargoTurno({ ...base, turno: { clase: "ocupado", estado: "presente", inicio: "2026-11-10T18:00:00Z", porcentaje_manual: null } })).toBeNull();
  });
});

describe("saldo e imputación", () => {
  it("saldo negativo es a favor", () => {
    expect(saldo({ cargos: [{ monto_gs: 290000 }], pagos: [{ monto_gs: 300000 }] })).toBe(-10000);
  });

  it("el pago que sobra no se imputa a nada", () => {
    const filas = imputarPagos({
      cargos: [{ id: "c1", fecha: "2026-11-03", monto_gs: 290000 }],
      pagos: [{ id: "p1", fecha: "2026-11-03", monto_gs: 300000 }],
    });
    expect(filas).toEqual([{ cargo_id: "c1", pagado: 290000, pendiente: 0, pagos: [{ pago_id: "p1", monto: 290000 }] }]);
  });

  it("un cargo cubierto por dos pagos", () => {
    const filas = imputarPagos({
      cargos: [{ id: "c1", fecha: "2026-11-03", monto_gs: 290000 }],
      pagos: [
        { id: "p2", fecha: "2026-11-10", monto_gs: 190000 },
        { id: "p1", fecha: "2026-11-05", monto_gs: 100000 },
      ],
    });
    expect(filas[0].pagos).toEqual([{ pago_id: "p1", monto: 100000 }, { pago_id: "p2", monto: 190000 }]);
    expect(filas[0].pendiente).toBe(0);
  });

  it("un ajuste negativo cuenta como crédito", () => {
    const filas = imputarPagos({
      cargos: [
        { id: "c1", fecha: "2026-11-03", monto_gs: 290000 },
        { id: "aj", fecha: "2026-11-04", monto_gs: -40000 },
      ],
      pagos: [],
    });
    expect(filas).toEqual([{ cargo_id: "c1", pagado: 40000, pendiente: 250000, pagos: [{ pago_id: "aj", monto: 40000 }] }]);
  });

  it.each([0, -1000, 10.5])("rechaza un pago de %s en vez de trabarse", (monto) => {
    const cargos = [{ id: "c1", fecha: "2026-11-03", monto_gs: 290000 }];
    expect(() => imputarPagos({ cargos, pagos: [{ id: "p1", fecha: "2026-11-04", monto_gs: monto }] })).toThrow(
      "Un pago tiene que ser un monto entero mayor a 0",
    );
  });
});

describe("vencimiento y atraso", () => {
  it("por sesión vence el mismo día", () => {
    expect(vencimiento({ fecha: "2026-11-12", plan: "por_sesion", cobraEnElMomento: false, diaLimitePago: 10 })).toBe("2026-11-12");
  });

  it("semanal vence el miércoles siguiente (domingo + 3)", () => {
    expect(vencimiento({ fecha: "2026-11-12", plan: "semanal", cobraEnElMomento: false, diaLimitePago: 10 })).toBe("2026-11-18");
    expect(vencimiento({ fecha: "2026-11-15", plan: "semanal", cobraEnElMomento: false, diaLimitePago: 10 })).toBe("2026-11-18");
  });

  it("mensual de diciembre vence en enero del año siguiente", () => {
    expect(vencimiento({ fecha: "2026-12-20", plan: "mensual", cobraEnElMomento: false, diaLimitePago: 10 })).toBe("2027-01-10");
  });

  it("los días de atraso cuentan desde el más viejo; los pagados no cuentan", () => {
    expect(
      atraso({
        cargos: [
          { vencimiento: "2026-10-10", pendiente: 0 },
          { vencimiento: "2026-11-01", pendiente: 100 },
          { vencimiento: "2026-11-05", pendiente: 100 },
        ],
        hoy: "2026-11-11",
      }),
    ).toEqual({ enAtraso: true, dias: 10 });
  });
});

describe("períodos", () => {
  it("la semana va de lunes a domingo", () => {
    expect(rangoSemana("2026-11-15")).toEqual({ desde: "2026-11-09", hasta: "2026-11-15" });
  });
  it("el mes es el calendario", () => {
    expect(rangoMes("2026-02-14")).toEqual({ desde: "2026-02-01", hasta: "2026-02-28" });
  });
});

describe("facturar", () => {
  it("meses en texto", () => {
    expect(textoMeses(["2026-09-15"])).toBe("septiembre 2026");
    expect(textoMeses(["2026-10-01", "2026-09-15", "2026-09-20"])).toBe("septiembre y octubre 2026");
    expect(textoMeses(["2026-08-01", "2026-09-01", "2026-10-01"])).toBe("agosto, septiembre y octubre 2026");
    expect(textoMeses(["2027-01-05", "2026-12-15"])).toBe("diciembre 2026 y enero 2027");
  });

  it("documento: RUC con DV o CI", () => {
    expect(documentoTutor({ doc_tipo: "RUC", doc_numero: "1234567", dv: "8" })).toBe("1234567-8");
    expect(documentoTutor({ doc_tipo: "CI", doc_numero: "7654321", dv: null })).toBe("7654321");
    expect(documentoTutor({ doc_tipo: null, doc_numero: null, dv: null })).toBeNull();
  });
});

describe("reportes", () => {
  it("con menos de 20 turnos de historia la tasa es 0", () => {
    expect(tasaAusenciasSinCobro(Array(19).fill({ estado: "ausente_con_aviso", monto_cargo: 0 }))).toBe(0);
  });

  it("horas trabajadas: presentes + reuniones y colegio ocupados", () => {
    const h = (i: string, f: string) => ({ inicio: `2026-11-10T${i}:00-03:00`, fin: `2026-11-10T${f}:00-03:00` });
    expect(
      horasTrabajadas([
        { clase: "turno", estado: "presente", ...h("08:00", "08:45"), tipoTurno: null },
        { clase: "turno", estado: "ausente_sin_aviso", ...h("09:00", "09:45"), tipoTurno: null },
        { clase: "ocupado", estado: "agendado", ...h("10:00", "11:00"), tipoTurno: { requiere_paciente: false, modalidad: "online" } },
        { clase: "ocupado", estado: "agendado", ...h("11:00", "11:15"), tipoTurno: { requiere_paciente: true, modalidad: "colegio" } },
        { clase: "ocupado", estado: "agendado", ...h("12:00", "13:00"), tipoTurno: null },
      ]),
    ).toBe(2);
  });
});

describe("clasificarCancelacion", () => {
  it("usa las horas mínimas del consultorio", () => {
    const inicio = new Date("2026-11-05T12:00:00Z");
    const avisoEn = new Date(inicio.getTime() - 30 * 3_600_000);
    expect(clasificarCancelacion({ inicio, avisoEn, horasAvisoMinimas: 24 })).toBe("ausente_con_aviso");
    expect(clasificarCancelacion({ inicio, avisoEn, horasAvisoMinimas: 48 })).toBe("aviso_tardio");
  });
});
