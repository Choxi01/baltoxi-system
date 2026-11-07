import "server-only";

import { exigirConsultorio } from "@/lib/auth/servidor";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { estadoFirma, textoEstadoFirma } from "./reglamento";

/**
 * Estado del reglamento de cada tutor, para el expediente (A8b): tutorId → texto ("Aceptado el
 * 7/11/2026 (versión 2)", "Sin aceptar"...). Vacío si el consultorio no cargó reglamento.
 */
export async function estadoReglamentoDeTutores(tutorIds: string[]): Promise<Record<string, string>> {
  if (tutorIds.length === 0) return {};
  const consultorio = await exigirConsultorio();
  const supabase = await crearClienteServidor();
  const [{ data: config }, { data: firmas }] = await Promise.all([
    supabase.from("consultorios").select("reglamento_texto, reglamento_version").eq("id", consultorio.id).single(),
    supabase
      .from("reglamento_firmas")
      .select("tutor_id, version, aceptado_en, nombre_firmante")
      .eq("consultorio_id", consultorio.id)
      .in("tutor_id", tutorIds),
  ]);
  if (!config) return {};
  const reglamento = { texto: config.reglamento_texto, version: config.reglamento_version };
  const textos: Record<string, string> = {};
  for (const id of tutorIds) {
    const texto = textoEstadoFirma(
      estadoFirma((firmas ?? []).filter((f) => f.tutor_id === id), reglamento),
      reglamento.version,
    );
    if (texto) textos[id] = texto;
  }
  return textos;
}
