"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { crearClienteServidor } from "@/lib/supabase/servidor";
import { RUTA_INGRESAR, RUTA_INICIO } from "./acceso";
import { validarNombreConsultorio } from "./consultorio";
import { COOKIE_ULTIMO_USO } from "./inactividad";
import { buscarConsultorio, exigirSesionCompleta } from "./servidor";

export async function salir() {
  const supabase = await crearClienteServidor();
  await supabase.auth.signOut();
  (await cookies()).delete(COOKIE_ULTIMO_USO);
  redirect(RUTA_INGRESAR);
}

export type EstadoFormulario = { error: string | null };

export async function crearConsultorio(
  _anterior: EstadoFormulario,
  formulario: FormData,
): Promise<EstadoFormulario> {
  const validacion = validarNombreConsultorio(formulario.get("nombre"));
  if (!validacion.ok) return { error: validacion.error };

  const { supabase } = await exigirSesionCompleta();
  // Si ya tiene uno (ej. tocó dos veces el botón), no crear otro.
  if (!(await buscarConsultorio())) {
    const { error } = await supabase.rpc("crear_consultorio", { p_nombre: validacion.nombre });
    if (error) return { error: "No se pudo crear el consultorio. Probá de nuevo." };
  }
  redirect(RUTA_INICIO);
}
