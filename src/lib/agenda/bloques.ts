// Bloques de la agenda: el horario de atención dividido en bloques de N minutos
// (docs/agenda.md). Funciones puras: sin Supabase ni zona horaria del navegador.

/** Un tramo de atención de un día de la semana (0 = domingo). Horas "HH:MM" (o "HH:MM:SS" de la base). */
export type Tramo = { dia_semana: number; desde: string; hasta: string };

/** Feriado o vacaciones: días "AAAA-MM-DD", los dos incluidos. */
export type Bloqueo = { desde: string; hasta: string; motivo?: string | null };

export type Bloque = { inicio: string; fin: string };

/** "9:05" o "09:05:00" → minutos desde la medianoche. */
export function aMinutos(hora: string): number {
  const [h, m] = hora.split(":").map(Number);
  return h * 60 + m;
}

/** 545 → "09:05" */
export function aHora(minutos: number): string {
  return `${String(Math.floor(minutos / 60)).padStart(2, "0")}:${String(minutos % 60).padStart(2, "0")}`;
}

/** "09:05" → "9:05" (como se escribe en los mensajes y la pantalla). */
export function horaCorta(hora: string): string {
  return aHora(aMinutos(hora)).replace(/^0/, "");
}

/** Día de la semana de "AAAA-MM-DD" (0 = domingo). No depende de la zona horaria. */
export function diaSemana(fecha: string): number {
  const [a, m, d] = fecha.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d)).getUTCDay();
}

/** El bloqueo que cae en esa fecha, si hay. */
export function bloqueoDelDia(fecha: string, bloqueos: Bloqueo[]): Bloqueo | null {
  // Las fechas "AAAA-MM-DD" se comparan bien como texto.
  return bloqueos.find((b) => b.desde <= fecha && fecha <= b.hasta) ?? null;
}

/** Bloques de una lista de tramos. Un bloque solo existe si entra entero en su tramo. */
export function bloquesDeTramos(tramos: Pick<Tramo, "desde" | "hasta">[], duracion: number): Bloque[] {
  if (!(duracion > 0)) return [];
  return [...tramos]
    .sort((a, b) => aMinutos(a.desde) - aMinutos(b.desde))
    .flatMap((t) => {
      const bloques: Bloque[] = [];
      const fin = aMinutos(t.hasta);
      for (let inicio = aMinutos(t.desde); inicio + duracion <= fin; inicio += duracion) {
        bloques.push({ inicio: aHora(inicio), fin: aHora(inicio + duracion) });
      }
      return bloques;
    });
}

/** Bloques de una fecha según el horario, la duración y los feriados/vacaciones. */
export function bloquesDelDia(fecha: string, horarios: Tramo[], duracion: number, bloqueos: Bloqueo[]): Bloque[] {
  if (bloqueoDelDia(fecha, bloqueos)) return [];
  const dia = diaSemana(fecha);
  return bloquesDeTramos(horarios.filter((h) => h.dia_semana === dia), duracion);
}
