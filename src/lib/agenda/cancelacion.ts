// Cancelar y reponer turnos (docs/agenda.md y docs/reglas-cobro.md sección 1).
// Funciones puras con tests.
//
// OJO: clasificarCancelacion es provisoria. Cuando la persona B haga la B2,
// se usa la de src/lib/cobro/ y se borra esta (mismos casos de prueba).

import { liberaBloque } from "./turnos";

export type QuienCancela = "familia" | "profesional";

/**
 * Cancelación de la familia: con `horasAvisoMinimas` (48 h) o más de aviso es
 * 'ausente_con_aviso'; con menos (o avisando después de la hora) es 'aviso_tardio'.
 */
export function clasificarCancelacion({
  inicio,
  avisoEn,
  horasAvisoMinimas,
}: {
  inicio: Date;
  avisoEn: Date;
  horasAvisoMinimas: number;
}): "ausente_con_aviso" | "aviso_tardio" {
  const horas = (inicio.getTime() - avisoEn.getTime()) / 3_600_000;
  return horas >= horasAvisoMinimas ? "ausente_con_aviso" : "aviso_tardio";
}

/** Qué se guarda en el turno al cancelar. Sin cargos: eso lo hace la B3. */
export function datosCancelacion(
  quien: QuienCancela,
  turno: { inicio: Date },
  avisoEn: Date,
  horasAvisoMinimas: number,
): { estado: "ausente_con_aviso" | "aviso_tardio" | "cancelado_profesional"; aviso_en: string | null; reponer: boolean } {
  if (quien === "profesional") return { estado: "cancelado_profesional", aviso_en: null, reponer: true };
  return {
    estado: clasificarCancelacion({ inicio: turno.inicio, avisoEn, horasAvisoMinimas }),
    aviso_en: avisoEn.toISOString(),
    reponer: false,
  };
}

type ParaReponer = { id: string; reponer: boolean; estado: string };
type Reposicion = { repone_a: string | null; estado: string };

/**
 * Turnos cancelados por la profesional que todavía no tienen reposición.
 * Si la reposición también se cancela, el turno vuelve a la lista.
 */
export function pendientesDeReponer<T extends ParaReponer>(cancelados: T[], reposiciones: Reposicion[]): T[] {
  const repuestos = new Set(reposiciones.filter((r) => r.repone_a && !liberaBloque(r.estado)).map((r) => r.repone_a));
  return cancelados.filter((t) => t.reponer && t.estado === "cancelado_profesional" && !repuestos.has(t.id));
}
