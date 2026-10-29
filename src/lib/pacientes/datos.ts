import "server-only";

import { z } from "zod";

import { exigirConsultorio } from "@/lib/auth/servidor";
import { crearClienteServidor } from "@/lib/supabase/servidor";

// Lecturas de pacientes. Todo pasa por RLS (cliente del usuario) y además se
// filtra por el consultorio, por las dudas.

export function esIdValido(id: string): boolean {
  return z.uuid().safeParse(id).success;
}

/** Lista para la pantalla Pacientes. Sin datos clínicos (regla de oro 7). */
export async function listarPacientes() {
  const consultorio = await exigirConsultorio();
  const supabase = await crearClienteServidor();
  const [{ data: pacientes, error }, { data: tutores }] = await Promise.all([
    supabase
      .from("pacientes")
      .select("id, nombre, apellido, fecha_nacimiento, estado, responsable_pago_id")
      .eq("consultorio_id", consultorio.id),
    supabase.from("tutores").select("id, nombre, apellido").eq("consultorio_id", consultorio.id),
  ]);
  if (error) throw new Error("No se pudieron leer los pacientes");
  const nombreTutor = new Map((tutores ?? []).map((t) => [t.id, `${t.nombre} ${t.apellido ?? ""}`.trim()]));
  return (pacientes ?? []).map((p) => ({
    ...p,
    responsable: p.responsable_pago_id ? (nombreTutor.get(p.responsable_pago_id) ?? null) : null,
  }));
}

/** Ficha completa de un paciente (incluye datos clínicos: solo para el expediente). */
export async function obtenerPaciente(id: string) {
  if (!esIdValido(id)) return null;
  const consultorio = await exigirConsultorio();
  const supabase = await crearClienteServidor();
  const { data: paciente } = await supabase
    .from("pacientes")
    .select("*")
    .eq("consultorio_id", consultorio.id)
    .eq("id", id)
    .maybeSingle();
  if (!paciente) return null;

  const { data: vinculos } = await supabase
    .from("paciente_tutores")
    .select("tutor_id, parentesco")
    .eq("consultorio_id", consultorio.id)
    .eq("paciente_id", id);
  const ids = (vinculos ?? []).map((v) => v.tutor_id);
  const { data: tutores } = ids.length
    ? await supabase.from("tutores").select("id, nombre, apellido, telefono_wa").in("id", ids)
    : { data: [] };

  return {
    paciente,
    tutores: (vinculos ?? []).flatMap((v) => {
      const tutor = (tutores ?? []).find((t) => t.id === v.tutor_id);
      return tutor ? [{ ...tutor, parentesco: v.parentesco }] : [];
    }),
  };
}

/** Tarifas activas para elegir en la ficha. */
export async function listarTarifas() {
  const consultorio = await exigirConsultorio();
  const supabase = await crearClienteServidor();
  const { data } = await supabase
    .from("tarifas")
    .select("id, nombre, monto_gs")
    .eq("consultorio_id", consultorio.id)
    .eq("activa", true)
    .order("monto_gs", { ascending: false });
  return data ?? [];
}
