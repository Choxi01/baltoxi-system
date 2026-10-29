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
    });
}

export const ORDENES = {
  apellido: "Apellido A-Z",
  nombre: "Nombre A-Z",
  menor: "Menor edad",
  mayor: "Mayor edad",
  recientes: "Recientes",
} as const;
export type Orden = keyof typeof ORDENES;

export function ordenDeFiltro(valor: string | undefined): Orden {
  return valor && valor in ORDENES ? (valor as Orden) : "apellido";
}

type PacienteOrdenable = PacienteBuscable & { fecha_nacimiento: string | null; creado_en: string };

/** Devuelve una copia ordenada. Sin fecha de nacimiento van al final al ordenar por edad. */
export function ordenarPacientes<T extends PacienteOrdenable>(pacientes: T[], orden: Orden): T[] {
  const porApellido = (a: T, b: T) =>
    normalizar(`${a.apellido ?? ""} ${a.nombre}`).localeCompare(normalizar(`${b.apellido ?? ""} ${b.nombre}`), "es");
  const porNombre = (a: T, b: T) =>
    normalizar(`${a.nombre} ${a.apellido ?? ""}`).localeCompare(normalizar(`${b.nombre} ${b.apellido ?? ""}`), "es");
  const porEdad = (menorPrimero: boolean) => (a: T, b: T) => {
    if (!a.fecha_nacimiento || !b.fecha_nacimiento) {
      if (a.fecha_nacimiento === b.fecha_nacimiento) return porApellido(a, b);
      return a.fecha_nacimiento ? -1 : 1;
    }
    // Menor = nació más tarde = fecha más grande.
    const diferencia = a.fecha_nacimiento.localeCompare(b.fecha_nacimiento);
    return (menorPrimero ? -diferencia : diferencia) || porApellido(a, b);
  };
  const comparar = {
    apellido: porApellido,
    nombre: porNombre,
    menor: porEdad(true),
    mayor: porEdad(false),
    recientes: (a: T, b: T) => b.creado_en.localeCompare(a.creado_en) || porApellido(a, b),
  }[orden];
  return [...pacientes].sort(comparar);
}

/** Estado elegido en la URL; si falta o es inválido, "activo". */
export function estadoDeFiltro(valor: string | undefined): EstadoPaciente | "todos" {
  if (valor === "todos") return "todos";
  return ESTADOS_PACIENTE.includes(valor as EstadoPaciente) ? (valor as EstadoPaciente) : "activo";
}
