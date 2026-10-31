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

/** Todos los tipos de turno, activos primero. */
export async function listarTiposTurno() {
  const consultorio = await exigirConsultorio();
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .from("tipos_turno")
    .select("id, nombre, modalidad, tarifa_id, cobra_en_el_momento, genera_cobro, requiere_paciente, activo")
    .eq("consultorio_id", consultorio.id)
    .order("activo", { ascending: false })
    .order("nombre");
  if (error) throw new Error("No se pudieron leer los tipos de turno");
  return data ?? [];
}

/**
 * Reglas de cobro: las generales (sin paciente) y las excepciones por paciente.
 * Trae también los pacientes activos, para elegir al agregar una excepción.
 */
export async function obtenerReglas() {
  const consultorio = await exigirConsultorio();
  const supabase = await crearClienteServidor();
  const [{ data: reglas, error }, { data: pacientes }] = await Promise.all([
    supabase.from("reglas_cobro").select("id, estado, porcentaje, paciente_id").eq("consultorio_id", consultorio.id),
    supabase.from("pacientes").select("id, nombre, apellido, estado").eq("consultorio_id", consultorio.id).order("nombre"),
  ]);
  if (error) throw new Error("No se pudieron leer las reglas de cobro");

  const nombre = new Map((pacientes ?? []).map((p) => [p.id, `${p.nombre} ${p.apellido ?? ""}`.trim()]));
  const generales: Record<string, number> = {};
  const excepciones: { id: string; paciente_id: string; paciente: string; estado: string; porcentaje: number }[] = [];
  for (const r of reglas ?? []) {
    if (r.paciente_id === null) generales[r.estado] = r.porcentaje;
    else excepciones.push({ ...r, paciente_id: r.paciente_id, paciente: nombre.get(r.paciente_id) ?? "Paciente" });
  }
  excepciones.sort((a, b) => a.paciente.localeCompare(b.paciente, "es"));

  return {
    generales,
    excepciones,
    pacientes: (pacientes ?? []).filter((p) => p.estado === "activo").map((p) => ({ id: p.id, nombre: nombre.get(p.id)! })),
  };
}
