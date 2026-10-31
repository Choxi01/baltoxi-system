// Supabase devuelve como máximo 1000 filas por consulta. Para sumar cargos y pagos de toda la
// historia hay que traer todo: se pide de a páginas hasta que una venga incompleta.
// La consulta tiene que tener un orden estable (ej. .order("id")) para no saltear ni repetir filas.

const PAGINA = 1000;

export async function leerTodo<T>(
  consulta: (desde: number, hasta: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const filas: T[] = [];
  for (let desde = 0; ; desde += PAGINA) {
    const { data, error } = await consulta(desde, desde + PAGINA - 1);
    if (error) throw new Error("No se pudieron leer los datos");
    filas.push(...(data ?? []));
    if (!data || data.length < PAGINA) return filas;
  }
}
