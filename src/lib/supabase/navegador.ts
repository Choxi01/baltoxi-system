import { createBrowserClient } from "@supabase/ssr";

import { supabaseAnonKey, supabaseUrl } from "./env";
import type { Database } from "./types";

// Cliente para componentes que corren en el navegador ("use client").
// Usa la clave pública: todo lo que ve pasa por RLS.
export function crearClienteNavegador() {
  return createBrowserClient<Database>(supabaseUrl(), supabaseAnonKey());
}
