// Medir cuánto tarda cada consulta a Supabase, para encontrar lo lento.
// Solo en desarrollo y solo si se pide: `MEDIR_SUPABASE=1 npm run dev`.
// Muestra el método, la tabla y los milisegundos. NUNCA la dirección completa: los
// filtros y los datos no salen en la consola (regla de oro 7).

/** "GET https://x.supabase.co/rest/v1/turnos?select=…" → "GET turnos". Sin filtros ni datos. */
export function describirPedido(url: string, metodo = "GET"): string {
  let ruta: string;
  try {
    ruta = new URL(url).pathname;
  } catch {
    return `${metodo} ?`;
  }
  const rest = ruta.match(/^\/rest\/v1\/(rpc\/)?([\w-]+)/);
  if (rest) return `${metodo} ${rest[1] ?? ""}${rest[2]}`;
  const servicio = ruta.match(/^\/(auth|storage)\/v1\/([\w.-]+)/);
  if (servicio) return `${metodo} ${servicio[1]}/${servicio[2]}`;
  return `${metodo} otro`;
}

export function medirActivado(): boolean {
  return process.env.NODE_ENV === "development" && process.env.MEDIR_SUPABASE === "1";
}

/** `fetch` que anota en la consola del servidor cuánto tardó cada consulta. */
export const fetchMedido: typeof fetch = async (entrada, opciones) => {
  const url = typeof entrada === "string" ? entrada : entrada instanceof URL ? entrada.href : entrada.url;
  const metodo = opciones?.method ?? (entrada instanceof Request ? entrada.method : "GET");
  const inicio = performance.now();
  try {
    const respuesta = await fetch(entrada, opciones);
    console.log(`[supabase] ${describirPedido(url, metodo)} ${respuesta.status} · ${Math.round(performance.now() - inicio)} ms`);
    return respuesta;
  } catch (error) {
    console.log(`[supabase] ${describirPedido(url, metodo)} falló · ${Math.round(performance.now() - inicio)} ms`);
    throw error;
  }
};
