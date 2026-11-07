import "server-only";

import { exigirConsultorio } from "@/lib/auth/servidor";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { validarEstructura, type Estructura } from "./estructura";

// Plantillas de anamnesis (Configuración > Anamnesis, tarea A6). No tienen datos de pacientes.

export type PlantillaAnamnesis = {
  id: string;
  nombre: string;
  activa: boolean;
  /** null: lo guardado no tiene el formato esperado (se muestra un aviso, no se puede usar). */
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
  return (data ?? []).map((p) => {
    const r = validarEstructura(p.estructura);
    return { id: p.id, nombre: p.nombre, activa: p.activa, estructura: r.ok ? r.estructura : null };
  });
}
