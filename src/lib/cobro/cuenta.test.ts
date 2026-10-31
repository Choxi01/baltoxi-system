// Cuenta del tutor y "quién debe". Datos inventados.

import { describe, expect, it } from "vitest";
import { cuentaTutor, quienDebe, type CargoCuenta, type FilaQuienDebe, type PagoCuenta } from "./cuenta";

const cargo = (id: string, fecha: string, monto: number, extra: Partial<CargoCuenta> = {}): CargoCuenta => ({
  id,
  fecha,
  monto_gs: monto,
  concepto: `Sesión ${fecha}`,
  paciente: "Niña Prueba",
  plan: "mensual",
  cobraEnElMomento: false,
  ...extra,
});
const pago = (id: string, fecha: string, monto: number, extra: Partial<PagoCuenta> = {}): PagoCuenta => ({
  id,
  fecha,
  monto_gs: monto,
  medio: "efectivo",
  referencia: null,
  factura_id: null,
  ...extra,
});

describe("cuentaTutor", () => {
  it("caso 15: FIFO, sep pagado y oct pendiente 450.000, con saldo acumulado", () => {
    const c = cuentaTutor({
      cargos: [cargo("sep", "2026-09-30", 580000), cargo("oct", "2026-10-31", 870000)],
      pagos: [pago("p1", "2026-11-01", 1000000)],
      hoy: "2026-11-05",
      diaLimitePago: 10,
    });
    expect(c.movimientos.map((m) => [m.id, m.saldo])).toEqual([
      ["sep", 580000],
      ["oct", 1450000],
      ["p1", 450000],
    ]);
    const [sep, oct, p1] = c.movimientos;
    expect(sep).toMatchObject({ pagado: 580000, pendiente: 0, cubiertoPor: [{ pago_id: "p1", fecha: "2026-11-01", monto: 580000 }] });
    expect(oct).toMatchObject({ pagado: 420000, pendiente: 450000, vencimiento: "2026-11-10", vencido: false });
    expect(p1).toMatchObject({
      cubre: [
        { cargo_id: "sep", monto: 580000 },
        { cargo_id: "oct", monto: 420000 },
      ],
      sinImputar: 0,
    });
    expect(c).toMatchObject({ saldo: 450000, aFavor: 0, enAtraso: false, vencidoGs: 0 });
  });

  it("caso 16: plan mensual, octubre impago, hoy 11/11 → 1 día de atraso", () => {
    const c = cuentaTutor({ cargos: [cargo("oct", "2026-10-20", 290000)], pagos: [], hoy: "2026-11-11", diaLimitePago: 10 });
    expect(c).toMatchObject({ enAtraso: true, diasAtraso: 1, vencidoGs: 290000 });
  });

  it("caso 17: mismo caso, hoy 10/11 → sin atraso", () => {
    const c = cuentaTutor({ cargos: [cargo("oct", "2026-10-20", 290000)], pagos: [], hoy: "2026-11-10", diaLimitePago: 10 });
    expect(c).toMatchObject({ enAtraso: false, diasAtraso: 0 });
  });

  it("caso 18: entrevista que cobra en el momento, impaga al día siguiente → en atraso", () => {
    const c = cuentaTutor({
      cargos: [cargo("ent", "2026-11-02", 280000, { cobraEnElMomento: true })],
      pagos: [],
      hoy: "2026-11-03",
      diaLimitePago: 10,
    });
    expect(c).toMatchObject({ enAtraso: true, diasAtraso: 1 });
  });

  it("saldo a favor: lo que sobra del pago queda sin imputar", () => {
    const c = cuentaTutor({
      cargos: [cargo("a", "2026-11-02", 290000)],
      pagos: [pago("p1", "2026-11-02", 400000)],
      hoy: "2026-11-05",
      diaLimitePago: 10,
    });
    expect(c).toMatchObject({ saldo: -110000, aFavor: 110000, enAtraso: false });
    expect(c.movimientos.at(-1)).toMatchObject({ tipo: "pago", sinImputar: 110000, saldo: -110000 });
  });

  it("mismo día: el cargo va antes que el pago", () => {
    const c = cuentaTutor({
      cargos: [cargo("z", "2026-11-02", 290000, { plan: "por_sesion" })],
      pagos: [pago("a", "2026-11-02", 290000)],
      hoy: "2026-11-02",
      diaLimitePago: 10,
    });
    expect(c.movimientos.map((m) => [m.tipo, m.saldo])).toEqual([
      ["cargo", 290000],
      ["pago", 0],
    ]);
  });

  it("ajuste negativo cuenta como crédito y no tiene vencimiento", () => {
    const c = cuentaTutor({
      cargos: [cargo("s", "2026-10-05", 290000), cargo("aj", "2026-10-06", -90000, { concepto: "Ajuste" })],
      pagos: [],
      hoy: "2026-11-20",
      diaLimitePago: 10,
    });
    expect(c.movimientos[0]).toMatchObject({ pendiente: 200000, cubiertoPor: [] });
    expect(c.movimientos[1]).toMatchObject({ vencimiento: null, vencido: false, saldo: 200000 });
    expect(c).toMatchObject({ saldo: 200000, enAtraso: true, vencidoGs: 200000 });
  });

  it("pago facturado queda marcado", () => {
    const c = cuentaTutor({ cargos: [], pagos: [pago("p", "2026-11-01", 100000, { factura_id: "f1" })], hoy: "2026-11-02", diaLimitePago: 10 });
    expect(c.movimientos[0]).toMatchObject({ facturado: true, sinImputar: 100000 });
  });
});

describe("quienDebe", () => {
  const fila = (nombre: string, saldo: number, diasAtraso = 0, vencidoGs = 0): FilaQuienDebe => ({
    tutorId: nombre,
    nombre,
    saldo,
    enAtraso: diasAtraso > 0,
    diasAtraso,
    vencidoGs,
  });

  it("ordena: atrasados (más días primero), deben, a favor; oculta saldo 0", () => {
    const r = quienDebe([
      fila("Cero", 0),
      fila("Favor chico", -10000),
      fila("Debe poco", 100000),
      fila("Atraso 3", 290000, 3, 290000),
      fila("Favor grande", -50000),
      fila("Debe mucho", 580000),
      fila("Atraso 20", 290000, 20, 290000),
    ]);
    expect(r.filas.map((f) => f.nombre)).toEqual(["Atraso 20", "Atraso 3", "Debe mucho", "Debe poco", "Favor grande", "Favor chico"]);
    expect(r.totales).toEqual({ debenGs: 1260000, vencidoGs: 580000, enAtraso: 2, aFavorGs: 60000 });
  });

  it("lista vacía", () => {
    expect(quienDebe([])).toEqual({ filas: [], totales: { debenGs: 0, vencidoGs: 0, enAtraso: 0, aFavorGs: 0 } });
  });
});
