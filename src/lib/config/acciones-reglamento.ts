"use server";

import { revalidatePath } from "next/cache";

import { exigirConsultorio } from "@/lib/auth/servidor";
import { MAXIMO_REGLAMENTO, guardarReglamento } from "@/lib/ficha/reglamento";
import { crearClienteServidor } from "@/lib/supabase/servidor";

export type EstadoReglamento = {
  errores: Partial<Record<string, string>>;
  guardadoEn: number | null;
  /** Versión después de guardar (para avisar si subió). */
  version?: number;
  revision?: number;
  enviado?: Record<string, string>;
};

function conError(errores: EstadoReglamento["errores"], formulario: FormData): EstadoReglamento {
  const enviado = Object.fromEntries([...formulario.entries()].map(([k, v]) => [k, String(v)]));
  return { errores, guardadoEn: null, enviado, revision: Date.now() };
}

/** Guarda el reglamento. Si el texto cambió, la versión sube y las familias lo tienen que volver a aceptar. */
export async function guardarReglamentoConsultorio(_anterior: EstadoReglamento, formulario: FormData): Promise<EstadoReglamento> {
  const texto = String(formulario.get("texto") ?? "");
  const versionVista = Number(formulario.get("version"));
  if (texto.length > MAXIMO_REGLAMENTO) {
    return conError({ texto: `El reglamento puede tener hasta ${MAXIMO_REGLAMENTO.toLocaleString("es-PY")} letras.` }, formulario);
  }
  const consultorio = await exigirConsultorio();
  const supabase = await crearClienteServidor();
  const { data: actual } = await supabase
    .from("consultorios")
    .select("reglamento_texto, reglamento_version")
    .eq("id", consultorio.id)
    .single();
  if (!actual) return conError({ general: "No se pudo guardar. Probá de nuevo." }, formulario);
  // Si otra pestaña lo cambió mientras tanto, no pisarlo.
  if (versionVista !== actual.reglamento_version) {
    return conError({ general: "El reglamento cambió desde que abriste esta pantalla. Recargá la página y volvé a editarlo." }, formulario);
  }
  const nuevo = guardarReglamento({ texto: actual.reglamento_texto, version: actual.reglamento_version }, texto);
  if (!nuevo.cambio) {
    const ahora = Date.now();
    return { errores: {}, guardadoEn: ahora, version: nuevo.version, revision: ahora };
  }
  const { error } = await supabase
    .from("consultorios")
    .update({ reglamento_texto: nuevo.texto, reglamento_version: nuevo.version })
    .eq("id", consultorio.id)
    .eq("reglamento_version", actual.reglamento_version);
  if (error) return conError({ general: "No se pudo guardar. Probá de nuevo." }, formulario);
  revalidatePath("/config");
  const ahora = Date.now();
  return { errores: {}, guardadoEn: ahora, version: nuevo.version, revision: ahora };
}
