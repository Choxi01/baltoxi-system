// Búsqueda y filtro de la lista de pacientes (sin tildes ni mayúsculas).

export const ESTADOS_PACIENTE = ["activo", "pausa", "alta"] as const;
export type EstadoPaciente = (typeof ESTADOS_PACIENTE)[number];

export const NOMBRE_ESTADO: Record<EstadoPaciente, string> = {
  activo: "Activo",
  pausa: "En pausa",
  alta: "De alta",
};

/** "  Benítez " → "benitez" */
export function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

type PacienteBuscable = { nombre: string; apellido: string | null; estado: string };

/** Filtro por estado ("todos" o un estado) y por palabras: todas tienen que aparecer en nombre o apellido. */
export function filtrarPacientes<T extends PacienteBuscable>(
  pacientes: T[],
  filtro: { q?: string; estado?: string },
): T[] {
  const palabras = normalizar(filtro.q ?? "").split(" ").filter(Boolean);
  const estado = filtro.estado && filtro.estado !== "todos" ? filtro.estado : null;
  return pacientes
    .filter((p) => !estado || p.estado === estado)
    .filter((p) => {
      const texto = normalizar(`${p.nombre} ${p.apellido ?? ""}`);
      return palabras.every((palabra) => texto.includes(palabra));
    })
    .sort((a, b) =>
      normalizar(`${a.apellido ?? ""} ${a.nombre}`).localeCompare(normalizar(`${b.apellido ?? ""} ${b.nombre}`), "es"),
    );
}

/** Estado elegido en la URL; si falta o es inválido, "activo". */
export function estadoDeFiltro(valor: string | undefined): EstadoPaciente | "todos" {
  if (valor === "todos") return "todos";
  return ESTADOS_PACIENTE.includes(valor as EstadoPaciente) ? (valor as EstadoPaciente) : "activo";
}
