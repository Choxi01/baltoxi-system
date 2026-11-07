// Para facturar (docs/reglas-cobro.md sección 7): una fila por familia con los pagos del mes
// que todavía no tienen factura. Lo normal es una factura por familia por mes.
// OJO regla de oro 7: el concepto nunca lleva datos clínicos, solo los meses de servicio.

import { finDeMes, inicioDeMes } from "@/lib/agenda/calendario";
import { MESES } from "@/lib/pacientes/fecha";
import { iva10 } from "./formato";
import { NOMBRE_MEDIO } from "./pago";
import { imputarPagos, type Imputacion } from "./saldo";
import type { Cargo, MedioPago, Pago } from "./tipos";

export type TutorFactura = {
  id: string;
  nombre: string;
  apellido: string | null;
  email: string | null;
  doc_tipo: "RUC" | "CI" | null;
  doc_numero: string | null;
  dv: string | null;
  razon_social: string | null;
};

export type FilaFacturar = {
  tutor_id: string;
  /** Nombre y apellido del tutor. */
  tutor: string;
  doc_tipo: "RUC" | "CI" | null;
  documento: string | null;
  razon_social: string;
  email: string | null;
  monto: number;
  iva: number;
  medios: MedioPago[];
  concepto: string;
  /** Pagos a los que hay que ponerles `factura_id` al cargar el número. */
  pago_ids: string[];
};

/** RUC con DV ("1234567-8") o CI tal cual. */
export function documentoTutor(t: Pick<TutorFactura, "doc_tipo" | "doc_numero" | "dv">): string | null {
  if (!t.doc_numero) return null;
  return t.doc_tipo === "RUC" && t.dv ? `${t.doc_numero}-${t.dv}` : t.doc_numero;
}

function unirConY(partes: string[]): string {
  return partes.length <= 1 ? (partes[0] ?? "") : `${partes.slice(0, -1).join(", ")} y ${partes[partes.length - 1]}`;
}

/**
 * Meses de servicio en texto, a partir de fechas "AAAA-MM-…":
 * "septiembre 2026", "septiembre y octubre 2026", "diciembre 2026 y enero 2027".
 */
export function textoMeses(fechas: string[]): string {
  const meses = [...new Set(fechas.map((f) => f.slice(0, 7)))].sort();
  const porAnio = new Map<string, string[]>();
  for (const m of meses) {
    const [anio, mes] = m.split("-");
    porAnio.set(anio, [...(porAnio.get(anio) ?? []), MESES[Number(mes) - 1]]);
  }
  return unirConY([...porAnio].map(([anio, nombres]) => `${unirConY(nombres)} ${anio}`));
}

/**
 * Filas para facturar del mes de `mes` ("AAAA-MM-…"), agrupadas por tutor.
 * `imputacion` es la de imputarPagos (de cada tutor, todas juntas); `cargos` da la fecha de cada cargo.
 */
export function paraFacturar({
  mes,
  pagos,
  imputacion,
  cargos,
  tutores,
  conceptoFactura,
}: {
  mes: string;
  pagos: Pago[];
  imputacion: Imputacion[];
  cargos: Pick<Cargo, "id" | "fecha">[];
  tutores: TutorFactura[];
  conceptoFactura: string;
}): FilaFacturar[] {
  const delMes = mes.slice(0, 7);
  const fechaCargo = new Map(cargos.map((c) => [c.id, c.fecha]));
  const cargosDePago = new Map<string, string[]>();
  for (const fila of imputacion) {
    for (const p of fila.pagos) cargosDePago.set(p.pago_id, [...(cargosDePago.get(p.pago_id) ?? []), fila.cargo_id]);
  }

  const porTutor = new Map<string, Pago[]>();
  for (const p of pagos) {
    if (p.factura_id != null || p.fecha.slice(0, 7) !== delMes) continue;
    porTutor.set(p.tutor_id, [...(porTutor.get(p.tutor_id) ?? []), p]);
  }

  return [...porTutor].map(([tutorId, suyos]) => {
    const tutor = tutores.find((t) => t.id === tutorId);
    if (!tutor) throw new Error("Falta el tutor de un pago");
    const monto = suyos.reduce((s, p) => s + p.monto_gs, 0);
    const fechas = suyos.flatMap((p) => cargosDePago.get(p.id) ?? []).flatMap((id) => fechaCargo.get(id) ?? []);
    const meses = textoMeses(fechas);
    const nombre = [tutor.nombre, tutor.apellido].filter(Boolean).join(" ");
    return {
      tutor_id: tutorId,
      tutor: nombre,
      doc_tipo: tutor.doc_tipo,
      documento: documentoTutor(tutor),
      razon_social: tutor.razon_social || nombre,
      email: tutor.email,
      monto,
      iva: iva10(monto),
      medios: [...new Set(suyos.map((p) => p.medio))],
      concepto: meses ? `${conceptoFactura} – sesiones de ${meses}` : conceptoFactura,
      pago_ids: suyos.map((p) => p.id),
    };
  });
}

/**
 * Las filas del mes a partir de toda la historia del consultorio, ordenadas por tutor.
 * La imputación se hace tutor por tutor: con todos juntos, los pagos de una familia
 * cubrirían cargos de otra. `pagos` y `cargos` tienen que ser TODOS (también los ya
 * facturados y los de otros meses), porque FIFO arranca desde el cargo más viejo.
 */
export function armarParaFacturar({
  mes,
  pagos,
  cargos,
  tutores,
  conceptoFactura,
}: {
  mes: string;
  pagos: Pago[];
  cargos: Cargo[];
  tutores: TutorFactura[];
  conceptoFactura: string;
}): FilaFacturar[] {
  const delTutor = <T extends { tutor_id: string }>(xs: T[], id: string) => xs.filter((x) => x.tutor_id === id);
  const imputacion = [...new Set(pagos.map((p) => p.tutor_id))].flatMap((id) =>
    imputarPagos({ cargos: delTutor(cargos, id), pagos: delTutor(pagos, id) }),
  );
  return paraFacturar({ mes, pagos, imputacion, cargos, tutores, conceptoFactura }).sort((a, b) => a.tutor.localeCompare(b.tutor, "es"));
}

/** "Efectivo, Transferencia". */
export function textoMedios(medios: MedioPago[]): string {
  return medios.map((m) => NOMBRE_MEDIO[m] ?? m).join(", ");
}

/** Lee el mes de la URL ("AAAA-MM") y devuelve su primer día. null si no es un mes o todavía no empezó. */
export function mesValido(valor: unknown, hoy: string): string | null {
  if (typeof valor !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(valor)) return null;
  const mes = `${valor}-01`;
  return mes <= inicioDeMes(hoy) ? mes : null;
}

/** ¿Todavía pueden entrar pagos en ese mes? (la lista se hace el último día del mes). */
export function mesSinTerminar(mes: string, hoy: string): boolean {
  return hoy < finDeMes(mes);
}

/** Número de factura "001-001-0000123". Se acepta sin guiones (es más fácil de escribir en el iPhone). */
export function validarNumeroFactura(texto: string): { ok: true; numero: string } | { ok: false; error: string } {
  const partes = /^(\d{3})-?(\d{3})-?(\d{7})$/.exec(texto.trim());
  if (!partes) return { ok: false, error: "Poné el número completo, por ejemplo 001-001-0000123." };
  return { ok: true, numero: `${partes[1]}-${partes[2]}-${partes[3]}` };
}

/** Deshacer borra el registro de la app: la factura sigue existiendo en Marangatu. */
export function textoDeshacer(numero: string): string {
  return `¿Deshacer la factura ${numero}?\n\nEsto no anula la factura en Marangatu: solo la saca de la app.\n\nLos pagos vuelven a la lista para facturar.`;
}

export function nombreExcel(mes: string): string {
  return `para-facturar-${mes.slice(0, 7)}.xlsx`;
}
