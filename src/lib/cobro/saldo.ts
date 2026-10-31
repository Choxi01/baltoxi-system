// Saldo, imputación FIFO, vencimiento y atraso (docs/reglas-cobro.md sección 5).
// El saldo nunca se guarda: se calcula (regla de oro 2).

import { inicioDeMes, lunesDe, sumarDias } from "@/lib/agenda/calendario";
import type { Cargo, Pago, PlanCobro } from "./tipos";

/** Saldo = suma(cargos) − suma(pagos). Positivo: debe. Negativo: a favor. */
export function saldo({ cargos, pagos }: { cargos: Pick<Cargo, "monto_gs">[]; pagos: Pick<Pago, "monto_gs">[] }): number {
  const suma = (xs: { monto_gs: number }[]) => xs.reduce((s, x) => s + x.monto_gs, 0);
  return suma(cargos) - suma(pagos);
}

export type Imputacion = {
  cargo_id: string;
  pagado: number;
  pendiente: number;
  /** Qué pagos cubrieron este cargo y cuánto de cada uno. */
  pagos: { pago_id: string; monto: number }[];
};

const porFecha = <T extends { fecha: string; id: string }>(a: T, b: T) =>
  a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0;

/**
 * Imputación FIFO: los pagos cancelan los cargos más viejos primero.
 * Los ajustes negativos (cargos con monto < 0) cuentan como crédito, igual que un pago.
 * Devuelve una fila por cargo positivo (o en 0), ordenadas del más viejo al más nuevo.
 */
export function imputarPagos({
  cargos,
  pagos,
}: {
  cargos: Pick<Cargo, "id" | "fecha" | "monto_gs">[];
  pagos: Pick<Pago, "id" | "fecha" | "monto_gs">[];
}): Imputacion[] {
  const aCubrir = cargos.filter((c) => c.monto_gs >= 0).sort(porFecha);
  const creditos = [
    ...pagos.map((p) => ({ id: p.id, fecha: p.fecha, resto: p.monto_gs })),
    ...cargos.filter((c) => c.monto_gs < 0).map((c) => ({ id: c.id, fecha: c.fecha, resto: -c.monto_gs })),
  ].sort(porFecha);

  let i = 0;
  return aCubrir.map((cargo) => {
    const fila: Imputacion = { cargo_id: cargo.id, pagado: 0, pendiente: cargo.monto_gs, pagos: [] };
    while (fila.pendiente > 0 && i < creditos.length) {
      const credito = creditos[i];
      const monto = Math.min(credito.resto, fila.pendiente);
      if (monto > 0) {
        fila.pagos.push({ pago_id: credito.id, monto });
        fila.pagado += monto;
        fila.pendiente -= monto;
        credito.resto -= monto;
      }
      if (credito.resto === 0) i++;
    }
    return fila;
  });
}

/**
 * Vencimiento de un cargo según el plan del paciente:
 * por sesión o tipo que cobra en el momento → el mismo día; semanal → domingo de esa semana + 3 días;
 * mensual → día `diaLimitePago` del mes siguiente.
 */
export function vencimiento({
  fecha,
  plan,
  cobraEnElMomento,
  diaLimitePago,
}: {
  fecha: string;
  plan: PlanCobro;
  cobraEnElMomento: boolean;
  diaLimitePago: number;
}): string {
  if (cobraEnElMomento || plan === "por_sesion") return fecha;
  if (plan === "semanal") return sumarDias(lunesDe(fecha), 6 + 3);
  return sumarDias(inicioDeMes(fecha, 1), diaLimitePago - 1);
}

/** Días entre dos fechas "AAAA-MM-DD" (hasta − desde). */
export function diasEntre(desde: string, hasta: string): number {
  const utc = (f: string) => {
    const [a, m, d] = f.split("-").map(Number);
    return Date.UTC(a, m - 1, d);
  };
  return Math.round((utc(hasta) - utc(desde)) / 86_400_000);
}

/** Atraso: cargos con pendiente > 0 y vencimiento < hoy. `dias` cuenta desde el más viejo. */
export function atraso({
  cargos,
  hoy,
}: {
  cargos: { vencimiento: string; pendiente: number }[];
  hoy: string;
}): { enAtraso: boolean; dias: number } {
  const vencidos = cargos.filter((c) => c.pendiente > 0 && c.vencimiento < hoy).map((c) => c.vencimiento).sort();
  if (vencidos.length === 0) return { enAtraso: false, dias: 0 };
  return { enAtraso: true, dias: diasEntre(vencidos[0], hoy) };
}
