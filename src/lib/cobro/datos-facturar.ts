import "server-only";

import { exigirConsultorio } from "@/lib/auth/servidor";
import { leerTodo } from "@/lib/supabase/paginar";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { armarParaFacturar, type FilaFacturar, type TutorFactura } from "./facturar";
import type { MedioPago } from "./tipos";

// Lecturas de "Para facturar" (B7). Solo datos administrativos (regla de oro 7): de los cargos
// se piden id, tutor, fecha y monto. Nunca el concepto, el motivo ni el paciente.

export type FilaParaFacturar = FilaFacturar & {
  /** Ya tiene una factura de este mes: estos pagos entraron después. */
  yaTieneFactura: boolean;
};

export type FacturaDelMes = {
  id: string;
  numero: string;
  tutor: string;
  monto: number;
  emitida_en: string;
};

/** `mes` = primer día del mes ("AAAA-MM-01"). */
export async function listarParaFacturar(mes: string): Promise<{ filas: FilaParaFacturar[]; facturas: FacturaDelMes[] }> {
  const consultorio = await exigirConsultorio();
  const supabase = await crearClienteServidor();

  const [{ data: datosConsultorio, error }, cargos, pagos, tutores, facturas] = await Promise.all([
    supabase.from("consultorios").select("concepto_factura").eq("id", consultorio.id).single(),
    leerTodo((de, a) =>
      supabase.from("cargos").select("id, tutor_id, fecha, monto_gs").eq("consultorio_id", consultorio.id).order("id").range(de, a),
    ),
    leerTodo((de, a) =>
      supabase.from("pagos").select("id, tutor_id, fecha, monto_gs, medio, factura_id").eq("consultorio_id", consultorio.id).order("id").range(de, a),
    ),
    // También los inactivos: un tutor dado de baja pudo haber pagado este mes.
    leerTodo((de, a) =>
      supabase
        .from("tutores")
        .select("id, nombre, apellido, email, doc_tipo, doc_numero, dv, razon_social")
        .eq("consultorio_id", consultorio.id)
        .order("id")
        .range(de, a),
    ),
    leerTodo((de, a) =>
      supabase
        .from("facturas")
        .select("id, tutor_id, numero, monto_gs, emitida_en")
        .eq("consultorio_id", consultorio.id)
        .eq("mes_cobro", mes)
        .order("id")
        .range(de, a),
    ),
  ]);
  if (error || !datosConsultorio) throw new Error("No se pudo leer el consultorio");

  const tutoresFactura = tutores as TutorFactura[];
  const filas = armarParaFacturar({
    mes,
    pagos: pagos.map((p) => ({ ...p, medio: p.medio as MedioPago })),
    cargos,
    tutores: tutoresFactura,
    conceptoFactura: datosConsultorio.concepto_factura,
  });

  const conFactura = new Set(facturas.map((f) => f.tutor_id));
  const nombres = new Map(tutoresFactura.map((t) => [t.id, [t.nombre, t.apellido].filter(Boolean).join(" ")]));
  return {
    filas: filas.map((f) => ({ ...f, yaTieneFactura: conFactura.has(f.tutor_id) })),
    facturas: facturas
      .map((f) => ({ id: f.id, numero: f.numero, tutor: nombres.get(f.tutor_id) ?? "", monto: f.monto_gs, emitida_en: f.emitida_en }))
      .sort((a, b) => a.numero.localeCompare(b.numero)),
  };
}
