"use server";

import { revalidatePath } from "next/cache";

import { exigirConsultorio } from "@/lib/auth/servidor";
import { hoyEnAsuncion } from "@/lib/fechas";
import { esIdValido } from "@/lib/pacientes/datos";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { validarPago, type ErroresPago } from "./pago";

// Pagos (B4). El saldo no se guarda en ningún lado: sale de cargos − pagos (regla de oro 2).

export type ResultadoPago = { ok: true } | { ok: false; error: string; errores?: ErroresPago };

const NO_SE_PUDO = "No se pudo guardar el pago. Probá de nuevo.";

function revalidar() {
  revalidatePath("/hoy");
  revalidatePath("/agenda");
  revalidatePath("/cobros", "layout"); // la lista y la cuenta de cada tutor
}

/** Registra un pago de un tutor (tutor, fecha, monto, efectivo/transferencia, referencia). */
export async function registrarPago(entrada: unknown): Promise<ResultadoPago> {
  const validacion = validarPago(entrada, hoyEnAsuncion());
  if (!validacion.ok) return { ok: false, error: "Revisá los datos del pago.", errores: validacion.errores };
  const datos = validacion.datos;

  const consultorio = await exigirConsultorio();
  const supabase = await crearClienteServidor();
  const { data: tutor } = await supabase
    .from("tutores")
    .select("id")
    .eq("consultorio_id", consultorio.id)
    .eq("id", datos.tutor_id)
    .maybeSingle();
  if (!tutor) return { ok: false, error: "No se encontró quién paga.", errores: { tutor_id: "Elegí quién paga." } };

  const { error } = await supabase.from("pagos").insert({ ...datos, consultorio_id: consultorio.id });
  if (error) return { ok: false, error: NO_SE_PUDO };
  revalidar();
  return { ok: true };
}

/** Borra un pago mal cargado. Si ya tiene factura no se puede (primero habría que anular la factura). */
export async function borrarPago(id: string): Promise<ResultadoPago> {
  if (!esIdValido(id)) return { ok: false, error: "Pago no encontrado." };
  const consultorio = await exigirConsultorio();
  const supabase = await crearClienteServidor();
  const { data: pago, error: errorLeer } = await supabase
    .from("pagos")
    .select("id, factura_id")
    .eq("consultorio_id", consultorio.id)
    .eq("id", id)
    .maybeSingle();
  if (errorLeer) return { ok: false, error: "No se pudo borrar. Probá de nuevo." };
  if (!pago) return { ok: false, error: "Pago no encontrado." };
  if (pago.factura_id) return { ok: false, error: "Ese pago ya está facturado: no se puede borrar." };

  const { error } = await supabase
    .from("pagos")
    .delete()
    .eq("consultorio_id", consultorio.id)
    .eq("id", id)
    .is("factura_id", null);
  if (error) return { ok: false, error: "No se pudo borrar. Probá de nuevo." };
  revalidar();
  return { ok: true };
}
