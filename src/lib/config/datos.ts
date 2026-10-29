import "server-only";

import { exigirConsultorio } from "@/lib/auth/servidor";
import { crearClienteServidor } from "@/lib/supabase/servidor";

// Lecturas de Configuración. Pasan por RLS y además se filtran por el consultorio.

/** Datos editables del consultorio (pestaña Consultorio). */
export async function obtenerConsultorio() {
  const consultorio = await exigirConsultorio();
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .from("consultorios")
    .select("nombre, profesional, ruc, dv, razon_social, direccion, datos_pago, horas_aviso_minimas, dia_limite_pago, concepto_factura")
    .eq("id", consultorio.id)
    .single();
  if (error || !data) throw new Error("No se pudo leer el consultorio");
  return data;
}

/** Todas las tarifas, activas primero. */
export async function listarTodasLasTarifas() {
  const consultorio = await exigirConsultorio();
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .from("tarifas")
    .select("id, nombre, monto_gs, activa")
    .eq("consultorio_id", consultorio.id)
    .order("activa", { ascending: false })
    .order("creado_en");
  if (error) throw new Error("No se pudieron leer las tarifas");
  return data ?? [];
}
