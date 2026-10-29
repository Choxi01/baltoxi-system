// Errores del login. Viajan en la URL como un código corto (?error=...),
// nunca con datos de la persona.

export type CodigoErrorIngreso = "datos" | "conexion";

/** Traduce el error de Supabase al código que va en la URL. */
export function codigoErrorIngreso(codigoSupabase: string | undefined): CodigoErrorIngreso {
  return codigoSupabase === "invalid_credentials" ? "datos" : "conexion";
}

/** Mensaje para mostrar en pantalla; null si no hay error o el código es desconocido. */
export function mensajeErrorIngreso(codigo: string | null): string | null {
  if (codigo === "datos") return "El email o la contraseña no son correctos.";
  if (codigo === "conexion") return "No se pudo ingresar. Revisá tu conexión y probá de nuevo.";
  return null;
}
