// Monto del período para el mensaje (docs/reglas-cobro.md sección 6).
// Semana = lunes a domingo. Mes = mes calendario.

import { finDeMes, inicioDeMes, lunesDe, sumarDias } from "@/lib/agenda/calendario";
import type { Cargo } from "./tipos";
import type { Imputacion } from "./saldo";

export type Rango = { desde: string; hasta: string };

export function rangoSemana(fecha: string): Rango {
  const desde = lunesDe(fecha);
  return { desde, hasta: sumarDias(desde, 6) };
}

export function rangoMes(fecha: string): Rango {
  return { desde: inicioDeMes(fecha), hasta: finDeMes(fecha) };
}

/**
 * Total del período = cargos del tutor con fecha en el período − lo imputado a esos cargos.
 * Pasá los cargos de un solo tutor (si tiene varios hijos, salen todos juntos).
 * Un ajuste negativo no se suma: es un crédito y ya bajó lo pendiente en la imputación (si no,
 * contaría dos veces).
 */
export function montoPeriodo({
  cargos,
  imputacion,
  desde,
  hasta,
}: {
  cargos: Pick<Cargo, "id" | "fecha" | "monto_gs">[];
  imputacion: Pick<Imputacion, "cargo_id" | "pagado">[];
  desde: string;
  hasta: string;
}): number {
  const pagado = new Map(imputacion.map((i) => [i.cargo_id, i.pagado]));
  return cargos
    .filter((c) => c.fecha >= desde && c.fecha <= hasta && c.monto_gs >= 0)
    .reduce((total, c) => total + c.monto_gs - (pagado.get(c.id) ?? 0), 0);
}
