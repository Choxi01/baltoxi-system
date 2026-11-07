import "server-only";

import { exigirConsultorio } from "@/lib/auth/servidor";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { leerEstructura, type Estructura } from "./plantilla";

// Lecturas de plantillas de anamnesis (tarea A6). Pasan por RLS y además se filtran por el consultorio.

export type PlantillaAnamnesis = {
  id: string;
  nombre: string;
  activa: boolean;
  /** null si la estructura guardada está dañada (la pantalla avisa en vez de romperse). */
  estructura: Estructura | null;
};

/** Todas las plantillas, activas primero y por nombre. */
export async function listarPlantillasAnamnesis(): Promise<PlantillaAnamnesis[]> {
  const consultorio = await exigirConsultorio();
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .from("plantillas_anamnesis")
    .select("id, nombre, activa, estructura")
    .eq("consultorio_id", consultorio.id)
    .order("activa", { ascending: false })
    .order("nombre");
  if (error) throw new Error("No se pudieron leer las plantillas de anamnesis");
  return (data ?? []).map((p) => ({ id: p.id, nombre: p.nombre, activa: p.activa, estructura: leerEstructura(p.estructura) }));
}
