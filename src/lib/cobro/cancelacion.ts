// Clasificar una cancelación de la familia (docs/reglas-cobro.md sección 1).
// Reemplaza a la provisoria de src/lib/agenda/cancelacion.ts: misma firma y mismo resultado.

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
