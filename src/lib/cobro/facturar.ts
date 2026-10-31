// Para facturar (docs/reglas-cobro.md sección 7): una factura por familia por mes,
// sobre los pagos del mes que todavía no tienen factura.
// OJO regla de oro 7: el concepto nunca lleva datos clínicos, solo los meses de servicio.

import { MESES } from "@/lib/pacientes/fecha";
import { iva10 } from "./formato";
import type { Cargo, MedioPago, Pago } from "./tipos";
import type { Imputacion } from "./saldo";

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
    return {
      tutor_id: tutorId,
      doc_tipo: tutor.doc_tipo,
      documento: documentoTutor(tutor),
      razon_social: tutor.razon_social || [tutor.nombre, tutor.apellido].filter(Boolean).join(" "),
      email: tutor.email,
      monto,
      iva: iva10(monto),
      medios: [...new Set(suyos.map((p) => p.medio))],
      concepto: meses ? `${conceptoFactura} – sesiones de ${meses}` : conceptoFactura,
      pago_ids: suyos.map((p) => p.id),
    };
  });
}
