// Fecha de nacimiento con tres ruedas (día, mes, año) en vez de calendario.

export const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
] as const;

export const ANIO_MINIMO = 1900;

/** Años para elegir: del actual hacia atrás hasta 1900 (los chicos quedan arriba). */
export function aniosParaElegir(hoy: string): number[] {
  const actual = Number(hoy.slice(0, 4));
  return Array.from({ length: actual - ANIO_MINIMO + 1 }, (_, i) => actual - i);
}

/** "2020-07-05" → { dia: "5", mes: "7", anio: "2020" }; vacío → todo "". */
export function partirFecha(fecha: string | null | undefined): { dia: string; mes: string; anio: string } {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha ?? "");
  if (!m) return { dia: "", mes: "", anio: "" };
  return { dia: String(Number(m[3])), mes: String(Number(m[2])), anio: m[1] };
}

export type ResultadoFecha = { ok: true; fecha: string | null } | { ok: false; error: string };

/**
 * Arma "AAAA-MM-DD" desde las tres ruedas. Las tres vacías = sin fecha.
 * Avisa si falta una parte o si la fecha no existe (ej. 31 de febrero).
 */
export function armarFecha(dia: string, mes: string, anio: string): ResultadoFecha {
  const partes = [dia, mes, anio].map((p) => p.trim());
  if (partes.every((p) => p === "")) return { ok: true, fecha: null };
  if (partes.some((p) => p === "")) return { ok: false, error: "Completá día, mes y año (o dejá los tres vacíos)." };
  if (!partes.every((p) => /^\d+$/.test(p))) return { ok: false, error: "La fecha no es válida." };

  const [d, m, a] = partes.map(Number);
  const prueba = new Date(Date.UTC(a, m - 1, d));
  if (m < 1 || m > 12 || d < 1 || prueba.getUTCMonth() !== m - 1 || prueba.getUTCDate() !== d) {
    return { ok: false, error: "Esa fecha no existe." };
  }
  return { ok: true, fecha: `${String(a).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}` };
}

/** "2020-07-05" → "5 de julio de 2020" */
export function textoFecha(fecha: string | null): string | null {
  const p = partirFecha(fecha);
  if (!p.anio) return null;
  return `${p.dia} de ${MESES[Number(p.mes) - 1]} de ${p.anio}`;
}
