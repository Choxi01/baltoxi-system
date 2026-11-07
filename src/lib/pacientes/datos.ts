import "server-only";

import { z } from "zod";

import { aHoraLocal } from "@/lib/agenda/turnos";
import { exigirConsultorio } from "@/lib/auth/servidor";
import { leerTodo } from "@/lib/supabase/paginar";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import type { Nota } from "./notas";
import type { TurnoPaciente } from "./turnos";

// Lecturas de pacientes. Todo pasa por RLS (cliente del usuario) y además se
// filtra por el consultorio, por las dudas.

export function esIdValido(id: string): boolean {
  return z.uuid().safeParse(id).success;
}

/** Todos los turnos de un paciente, para "Turnos y cuenta". Sin el motivo de las excepciones. */
export async function listarTurnosPaciente(pacienteId: string): Promise<TurnoPaciente[]> {
  if (!esIdValido(pacienteId)) return [];
  const consultorio = await exigirConsultorio();
  const supabase = await crearClienteServidor();
  const filas = await leerTodo((de, a) =>
    supabase
      .from("turnos")
      .select("id, estado, inicio, tipos_turno!turnos_consultorio_id_tipo_turno_id_fkey(nombre)")
      .eq("consultorio_id", consultorio.id)
      .eq("paciente_id", pacienteId)
      .eq("clase", "turno")
      .order("inicio")
      .order("id")
      .range(de, a),
  );
  return filas.map((t) => {
    const { fecha, hora } = aHoraLocal(t.inicio);
    return { id: t.id, estado: t.estado, fecha, hora, tipo: t.tipos_turno?.nombre ?? null };
  });
}

/** Lista para la pantalla Pacientes. Sin datos clínicos (regla de oro 7). */
export async function listarPacientes() {
  const consultorio = await exigirConsultorio();
  const supabase = await crearClienteServidor();
  const [{ data: pacientes, error }, { data: tutores }] = await Promise.all([
    supabase
      .from("pacientes")
      .select("id, nombre, apellido, fecha_nacimiento, estado, responsable_pago_id, creado_en")
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
  const [{ data: tutores }, { data: otrosVinculos }] = ids.length
    ? await Promise.all([
        supabase
          .from("tutores")
          .select("id, nombre, apellido, telefono_wa, email, doc_tipo, doc_numero, dv, razon_social, token_ficha, cambios_familia_en")
          .in("id", ids),
        // Otros hijos de estos tutores (para avisar que el cambio les afecta).
        supabase
          .from("paciente_tutores")
          .select("tutor_id, pacientes!paciente_tutores_consultorio_id_paciente_id_fkey(id, nombre)")
          .in("tutor_id", ids)
          .neq("paciente_id", id),
      ])
    : [{ data: [] }, { data: [] }];

  return {
    paciente,
    tutores: (vinculos ?? []).flatMap((v) => {
      const tutor = (tutores ?? []).find((t) => t.id === v.tutor_id);
      if (!tutor) return [];
      const otrosHijos = (otrosVinculos ?? [])
        .filter((o) => o.tutor_id === tutor.id && o.pacientes)
        .map((o) => o.pacientes!.nombre);
      return [{ ...tutor, parentesco: v.parentesco, otrosHijos }];
    }),
  };
}

/** Tutores del consultorio que todavía no están en este paciente (para "Elegir existente"). */
export async function listarTutoresParaVincular(pacienteId: string) {
  if (!esIdValido(pacienteId)) return [];
  const consultorio = await exigirConsultorio();
  const supabase = await crearClienteServidor();
  const [{ data: tutores }, { data: vinculos }] = await Promise.all([
    supabase.from("tutores").select("id, nombre, apellido, telefono_wa").eq("consultorio_id", consultorio.id).eq("activo", true),
    supabase
      .from("paciente_tutores")
      .select("tutor_id, paciente_id, pacientes!paciente_tutores_consultorio_id_paciente_id_fkey(nombre)")
      .eq("consultorio_id", consultorio.id),
  ]);
  const yaVinculados = new Set((vinculos ?? []).filter((v) => v.paciente_id === pacienteId).map((v) => v.tutor_id));
  return (tutores ?? [])
    .filter((t) => !yaVinculados.has(t.id))
    .map((t) => ({
      ...t,
      hijos: (vinculos ?? []).filter((v) => v.tutor_id === t.id && v.pacientes).map((v) => v.pacientes!.nombre),
    }));
}

/**
 * Tarifas para elegir en la ficha: las activas y, si se pasa, la que el paciente
 * ya tiene aunque esté desactivada (para no perderla al guardar).
 */
export async function listarTarifas(actualId?: string | null) {
  const consultorio = await exigirConsultorio();
  const supabase = await crearClienteServidor();
  const { data } = await supabase
    .from("tarifas")
    .select("id, nombre, monto_gs, activa")
    .eq("consultorio_id", consultorio.id)
    .order("monto_gs", { ascending: false });
  return (data ?? [])
    .filter((t) => t.activa || t.id === actualId)
    .map(({ id, nombre, monto_gs }) => ({ id, nombre, monto_gs }));
}

/** Notas del paciente (DATOS CLÍNICOS: solo para el expediente). Sin ordenar: ver `ordenarNotas`. */
export async function listarNotas(pacienteId: string): Promise<Nota[]> {
  if (!esIdValido(pacienteId)) return [];
  const consultorio = await exigirConsultorio();
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .from("notas")
    .select("id, fecha, texto, fijada, turno_id, creado_en, actualizado_en")
    .eq("consultorio_id", consultorio.id)
    .eq("paciente_id", pacienteId);
  // Mensaje genérico: nunca datos de la nota en errores ni logs.
  if (error) throw new Error("No se pudieron leer las notas");
  return data ?? [];
}

/**
 * "Agregar nota de esta sesión": el turno, si es de este paciente, con su fecha en Asunción.
 * Si no existe o es de otro paciente, null (la nota se crea sin sesión).
 */
export async function obtenerTurnoParaNota(turnoId: string, pacienteId: string): Promise<{ id: string; fecha: string } | null> {
  if (!esIdValido(turnoId) || !esIdValido(pacienteId)) return null;
  const consultorio = await exigirConsultorio();
  const supabase = await crearClienteServidor();
  const { data } = await supabase
    .from("turnos")
    .select("id, inicio")
    .eq("consultorio_id", consultorio.id)
    .eq("paciente_id", pacienteId)
    .eq("id", turnoId)
    .maybeSingle();
  return data ? { id: data.id, fecha: aHoraLocal(data.inicio).fecha } : null;
}
