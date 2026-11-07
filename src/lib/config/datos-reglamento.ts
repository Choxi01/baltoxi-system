import "server-only";

import { exigirConsultorio } from "@/lib/auth/servidor";
import { crearClienteServidor } from "@/lib/supabase/servidor";

/** Texto y versión del reglamento del consultorio, y cuántas firmas tiene la versión actual (tarea A8b). */
export async function obtenerReglamento(): Promise<{ texto: string | null; version: number; firmasVersionActual: number }> {
  const consultorio = await exigirConsultorio();
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .from("consultorios")
    .select("reglamento_texto, reglamento_version")
    .eq("id", consultorio.id)
    .single();
  if (error || !data) throw new Error("No se pudo leer el reglamento");
  const { count } = await supabase
    .from("reglamento_firmas")
    .select("id", { count: "exact", head: true })
    .eq("consultorio_id", consultorio.id)
    .eq("version", data.reglamento_version);
  return { texto: data.reglamento_texto, version: data.reglamento_version, firmasVersionActual: count ?? 0 };
}
