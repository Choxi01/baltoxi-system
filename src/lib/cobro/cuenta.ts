// Cuenta de un tutor y lista de "quién debe" (docs/reglas-cobro.md §5).
// Arma lo que se muestra a partir de saldo.ts (imputación FIFO, vencimiento, atraso). Funciones puras.

import { atraso, imputarPagos, saldo, vencimiento } from "./saldo";
import type { PlanCobro } from "./tipos";

export type CargoCuenta = {
  id: string;
  fecha: string;
  monto_gs: number;
  concepto: string;
  /** Nombre del paciente (para familias con varios hijos). */
  paciente: string | null;
  /** Plan del paciente; un ajuste sin paciente usa el mensual. */
  plan: PlanCobro;
  cobraEnElMomento: boolean;
};

export type PagoCuenta = {
  id: string;
  fecha: string;
  monto_gs: number;
  medio: string;
  referencia: string | null;
  factura_id: string | null;
};

export type MovimientoCargo = {
  tipo: "cargo";
  id: string;
  fecha: string;
  concepto: string;
  paciente: string | null;
  monto: number;
  /** Solo para cargos positivos (un ajuste negativo es un crédito). */
  vencimiento: string | null;
  pagado: number;
  pendiente: number;
  vencido: boolean;
  /** Qué pagos cubrieron este cargo (FIFO). */
  cubiertoPor: { pago_id: string; fecha: string; monto: number }[];
  /** Saldo del tutor después de este movimiento. */
  saldo: number;
};

export type MovimientoPago = {
  tipo: "pago";
  id: string;
  fecha: string;
  monto: number;
  medio: string;
  referencia: string | null;
  facturado: boolean;
  /** A qué cargos se imputó (FIFO). */
  cubre: { cargo_id: string; concepto: string; monto: number }[];
  /** Lo que quedó sin imputar: es saldo a favor. */
  sinImputar: number;
  saldo: number;
};

export type Movimiento = MovimientoCargo | MovimientoPago;

export type Cuenta = {
  /** Del más viejo al más nuevo, con el saldo acumulado. */
  movimientos: Movimiento[];
  /** > 0 debe, < 0 a favor. */
  saldo: number;
  aFavor: number;
  /** Suma de lo pendiente de cargos ya vencidos. */
  vencidoGs: number;
  enAtraso: boolean;
  diasAtraso: number;
};

/** Mismo día: primero el cargo y después el pago (así una sesión pagada en el momento deja el saldo en 0). */
function orden(a: Movimiento, b: Movimiento): number {
  if (a.fecha !== b.fecha) return a.fecha < b.fecha ? -1 : 1;
  if (a.tipo !== b.tipo) return a.tipo === "cargo" ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export function cuentaTutor({
  cargos,
  pagos,
  hoy,
  diaLimitePago,
}: {
  cargos: CargoCuenta[];
  pagos: PagoCuenta[];
  hoy: string;
  diaLimitePago: number;
}): Cuenta {
  const imputaciones = new Map(imputarPagos({ cargos, pagos }).map((i) => [i.cargo_id, i]));
  const fechaPago = new Map(pagos.map((p) => [p.id, p.fecha]));
  const conceptoCargo = new Map(cargos.map((c) => [c.id, c.concepto]));

  // A qué cargos fue cada pago.
  const cubre = new Map<string, MovimientoPago["cubre"]>();
  for (const i of imputaciones.values()) {
    for (const p of i.pagos) {
      if (!cubre.has(p.pago_id)) cubre.set(p.pago_id, []);
      cubre.get(p.pago_id)!.push({ cargo_id: i.cargo_id, concepto: conceptoCargo.get(i.cargo_id) ?? "", monto: p.monto });
    }
  }

  const movCargos: MovimientoCargo[] = cargos.map((c) => {
    const imp = imputaciones.get(c.id);
    const venc = c.monto_gs >= 0 ? vencimiento({ fecha: c.fecha, plan: c.plan, cobraEnElMomento: c.cobraEnElMomento, diaLimitePago }) : null;
    const pendiente = imp?.pendiente ?? 0;
    return {
      tipo: "cargo",
      id: c.id,
      fecha: c.fecha,
      concepto: c.concepto,
      paciente: c.paciente,
      monto: c.monto_gs,
      vencimiento: venc,
      pagado: imp?.pagado ?? 0,
      pendiente,
      vencido: venc != null && pendiente > 0 && venc < hoy,
      // Los ajustes negativos también cuentan como crédito: solo se listan los pagos de verdad.
      cubiertoPor: (imp?.pagos ?? [])
        .filter((p) => fechaPago.has(p.pago_id))
        .map((p) => ({ pago_id: p.pago_id, fecha: fechaPago.get(p.pago_id)!, monto: p.monto })),
      saldo: 0,
    };
  });

  const movPagos: MovimientoPago[] = pagos.map((p) => {
    const lista = cubre.get(p.id) ?? [];
    return {
      tipo: "pago",
      id: p.id,
      fecha: p.fecha,
      monto: p.monto_gs,
      medio: p.medio,
      referencia: p.referencia,
      facturado: p.factura_id != null,
      cubre: lista,
      sinImputar: p.monto_gs - lista.reduce((s, x) => s + x.monto, 0),
      saldo: 0,
    };
  });

  const movimientos: Movimiento[] = [...movCargos, ...movPagos].sort(orden);
  let acumulado = 0;
  for (const m of movimientos) {
    acumulado += m.tipo === "cargo" ? m.monto : -m.monto;
    m.saldo = acumulado;
  }

  const total = saldo({ cargos, pagos });
  const conVencimiento = movCargos.filter((c) => c.vencimiento != null).map((c) => ({ vencimiento: c.vencimiento!, pendiente: c.pendiente }));
  const { enAtraso, dias } = atraso({ cargos: conVencimiento, hoy });
  return {
    movimientos,
    saldo: total,
    aFavor: total < 0 ? -total : 0,
    vencidoGs: movCargos.filter((c) => c.vencido).reduce((s, c) => s + c.pendiente, 0),
    enAtraso,
    diasAtraso: dias,
  };
}

export type FilaQuienDebe = {
  tutorId: string;
  nombre: string;
  saldo: number;
  enAtraso: boolean;
  diasAtraso: number;
  vencidoGs: number;
};

/**
 * Lista de "quién debe": primero los atrasados (más días arriba), después los que deben sin atraso
 * (más deuda arriba) y al final los que tienen saldo a favor. Saldo 0 no se muestra.
 */
export function quienDebe(filas: FilaQuienDebe[]): {
  filas: FilaQuienDebe[];
  totales: { debenGs: number; vencidoGs: number; enAtraso: number; aFavorGs: number };
} {
  const grupo = (f: FilaQuienDebe) => (f.saldo > 0 && f.enAtraso ? 0 : f.saldo > 0 ? 1 : 2);
  const visibles = filas
    .filter((f) => f.saldo !== 0)
    .sort(
      (a, b) =>
        grupo(a) - grupo(b) ||
        (grupo(a) === 0 ? b.diasAtraso - a.diasAtraso : 0) ||
        (grupo(a) === 2 ? a.saldo - b.saldo : b.saldo - a.saldo) ||
        a.nombre.localeCompare(b.nombre, "es"),
    );
  const deben = visibles.filter((f) => f.saldo > 0);
  return {
    filas: visibles,
    totales: {
      debenGs: deben.reduce((s, f) => s + f.saldo, 0),
      vencidoGs: deben.reduce((s, f) => s + f.vencidoGs, 0),
      enAtraso: deben.filter((f) => f.enAtraso).length,
      aFavorGs: visibles.filter((f) => f.saldo < 0).reduce((s, f) => s - f.saldo, 0),
    },
  };
}

/** "2026-11-05" → "05/11/2026". */
export function fechaCorta(fecha: string): string {
  const [a, m, d] = fecha.split("-");
  return `${d}/${m}/${a}`;
}
