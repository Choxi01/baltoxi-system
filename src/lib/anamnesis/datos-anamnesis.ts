import "server-only";

import { exigirConsultorio } from "@/lib/auth/servidor";
import { esIdValido } from "@/lib/pacientes/datos";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { validarEstructura, type Estructura } from "./estructura";
import { leerRespuestas, type Respuestas } from "./respuestas";

// Anamnesis de un paciente (tarea A6b). DATOS CLÍNICOS: solo para el expediente; nunca se loguean.

export type Anamnesis = {
  id: string;
  fecha: string;
  plantilla: string;
  /** null: lo guardado no tiene el formato esperado (se avisa y no se puede editar). */
  estructura: Estructura | null;
  respuestas: Respuestas;
};

const COLUMNAS = "id, fecha, estructura, respuestas, plantillas_anamnesis(nombre)";

type Fila = {
  id: string;
  fecha: string;
  estructura: unknown;
  respuestas: unknown;
  plantillas_anamnesis: { nombre: string } | null;
};

function aAnamnesis(fila: Fila): Anamnesis {
  const r = validarEstructura(fila.estructura);
  const estructura = r.ok ? r.estructura : null;
  return {
    id: fila.id,
    fecha: fila.fecha,
    plantilla: fila.plantillas_anamnesis?.nombre ?? "Anamnesis",
    estructura,
    respuestas: estructura ? leerRespuestas(estructura, fila.respuestas) : {},
  };
}

/** Las anamnesis del paciente, la más nueva primero. */
export async function listarAnamnesis(pacienteId: string): Promise<Anamnesis[]> {
  if (!esIdValido(pacienteId)) return [];
  const consultorio = await exigirConsultorio();
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .from("anamnesis")
    .select(COLUMNAS)
    .eq("consultorio_id", consultorio.id)
    .eq("paciente_id", pacienteId)
    .order("fecha", { ascending: false })
    .order("creado_en", { ascending: false });
  if (error) throw new Error("No se pudieron leer las anamnesis");
  return (data ?? []).map(aAnamnesis);
}

/** Una anamnesis de ese paciente (vista para leer e imprimir). */
export async function obtenerAnamnesis(pacienteId: string, anamnesisId: string): Promise<Anamnesis | null> {
  if (!esIdValido(pacienteId) || !esIdValido(anamnesisId)) return null;
  const consultorio = await exigirConsultorio();
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .from("anamnesis")
    .select(COLUMNAS)
    .eq("consultorio_id", consultorio.id)
    .eq("paciente_id", pacienteId)
    .eq("id", anamnesisId)
    .maybeSingle();
  if (error) throw new Error("No se pudo leer la anamnesis");
  return data ? aAnamnesis(data) : null;
}
