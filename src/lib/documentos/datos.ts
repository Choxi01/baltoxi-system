import "server-only";

import { exigirConsultorio } from "@/lib/auth/servidor";
import { esIdValido } from "@/lib/pacientes/datos";
import { crearClienteServidor } from "@/lib/supabase/servidor";

export type Documento = {
  id: string;
  tipo: string;
  titulo: string;
  fecha: string | null;
  mime: string;
  tamano_bytes: number;
  creado_en: string;
};

/** Documentos del paciente, el más nuevo arriba (DATOS CLÍNICOS: solo para el expediente). Sin la ruta del archivo. */
export async function listarDocumentos(pacienteId: string): Promise<Documento[]> {
  if (!esIdValido(pacienteId)) return [];
  const consultorio = await exigirConsultorio();
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .from("documentos")
    .select("id, tipo, titulo, fecha, mime, tamano_bytes, creado_en")
    .eq("consultorio_id", consultorio.id)
    .eq("paciente_id", pacienteId)
    .order("creado_en", { ascending: false });
  if (error) throw new Error("No se pudieron leer los documentos");
  return data ?? [];
}
