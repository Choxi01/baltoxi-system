// Reportes (docs/reglas-cobro.md sección 8). Fechas "AAAA-MM-DD", rangos con los dos extremos incluidos.
// Funciones puras: los datos los trae datos-reportes.ts. Lo que Daniela todavía no confirmó está en
// criterios-reportes.ts. Solo datos administrativos (regla de oro 7).

import { diaSemana } from "@/lib/agenda/bloques";
import { diasVisibles, fechasEntre, finDeMes, inicioDeMes, lunesDe, sumarDias } from "@/lib/agenda/calendario";
import type { TurnoAgenda } from "@/lib/agenda/turnos";
import { hoyEnAsuncion } from "@/lib/fechas";
import { MESES } from "@/lib/pacientes/fecha";
import { montoBase } from "./cargo";
import { CRITERIO_AUSENCIAS, CRITERIO_HORAS, type CriterioAusencias, type CriterioHoras } from "./criterios-reportes";
import { imputarPagos } from "./saldo";
import type { Cargo, EstadoTurno, Paciente, Pago, Tarifa, TipoTurno } from "./tipos";

const sumaEnRango = (xs: { fecha: string; monto_gs: number }[], desde: string, hasta: string) =>
  xs.filter((x) => x.fecha >= desde && x.fecha <= hasta).reduce((s, x) => s + x.monto_gs, 0);

/** Generado (día o mes) = suma de cargos con fecha en el rango. */
export function generado(cargos: Pick<Cargo, "fecha" | "monto_gs">[], desde: string, hasta: string): number {
  return sumaEnRango(cargos, desde, hasta);
}

/** Cobrado = suma de pagos con fecha en el rango. */
export function cobrado(pagos: Pick<Pago, "fecha" | "monto_gs">[], desde: string, hasta: string): number {
  return sumaEnRango(pagos, desde, hasta);
}

/**
 * Tasa de ausencias sin cobro (pasá solo los turnos de la historia, ver `tasaDelMes`).
 * Cuenta los turnos ya marcados; "sin cobro" lo define el criterio.
 * Con menos turnos de historia que el mínimo, la tasa es 0.
 */
export function tasaAusenciasSinCobro(
  turnos: { estado: EstadoTurno; monto_cargo: number }[],
  criterio: CriterioAusencias = CRITERIO_AUSENCIAS,
): number {
  const marcados = turnos.filter((t) => !criterio.estadosFuera.includes(t.estado));
  if (marcados.length < criterio.historiaMinima) return 0;
  return marcados.filter(criterio.esSinCobro).length / marcados.length;
}

/** Proyección = generado del mes + Σ(monto base de los agendados que quedan) × (1 − tasa). */
export function proyeccionMes({
  generado: generadoMes,
  montosBaseAgendados,
  tasa,
}: {
  generado: number;
  montosBaseAgendados: number[];
  tasa: number;
}): number {
  const pendiente = montosBaseAgendados.reduce((s, m) => s + m, 0);
  return generadoMes + Math.round(pendiente * (1 - tasa));
}

/** Sin acentos y en minúscula, para comparar lo que se escribe a mano. */
const normalizar = (texto: string) =>
  texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

/** Horas trabajadas = turnos 'presente' + bloques ocupados de reunión o colegio (criterio en criterios-reportes.ts). */
export function horasTrabajadas(
  turnos: {
    clase: "turno" | "reservado" | "ocupado";
    estado: EstadoTurno;
    inicio: Date | string;
    fin: Date | string;
    tipoTurno: Pick<TipoTurno, "requiere_paciente" | "modalidad"> | null;
    motivo_ocupado?: string | null;
  }[],
  criterio: CriterioHoras = CRITERIO_HORAS,
): number {
  const ocupadoCuenta = (t: (typeof turnos)[number]) => {
    if (t.tipoTurno && criterio.ocupadoPorTipo(t.tipoTurno)) return true;
    const motivo = normalizar(t.motivo_ocupado ?? "");
    return criterio.palabrasOcupado.some((p) => motivo.includes(p));
  };
  const minutos = turnos
    .filter((t) => (t.clase === "turno" && criterio.estadosTurno.includes(t.estado)) || (t.clase === "ocupado" && ocupadoCuenta(t)))
    .reduce((s, t) => s + (new Date(t.fin).getTime() - new Date(t.inicio).getTime()) / 60_000, 0);
  return minutos / 60;
}

// ---------------------------------------------------------------------
// Lo que hace falta para armar la pantalla y el Excel
// ---------------------------------------------------------------------

export type CargoReporte = Pick<Cargo, "id" | "tutor_id" | "fecha" | "monto_gs"> & {
  turno_id: string | null;
  tipo: "sesion" | "ajuste";
};

export type PagoReporte = Pick<Pago, "id" | "tutor_id" | "fecha" | "monto_gs">;

export type TurnoReporte = {
  id: string;
  clase: "turno" | "reservado" | "ocupado";
  estado: EstadoTurno;
  inicio: string;
  fin: string;
  /** Solo para decidir si suma horas: nunca se muestra ni se exporta. */
  motivo_ocupado: string | null;
  tipoTurno: Pick<TipoTurno, "tarifa_id" | "genera_cobro" | "requiere_paciente" | "modalidad"> | null;
  paciente: Pick<Paciente, "tarifa_id" | "monto_override_gs"> | null;
};

/** El día de Asunción de un turno (regla de oro 6). */
const fechaDe = (t: Pick<TurnoReporte, "inicio">) => hoyEnAsuncion(new Date(t.inicio));

const delRango = <T extends Pick<TurnoReporte, "inicio">>(turnos: T[], desde: string, hasta: string) =>
  turnos.filter((t) => fechaDe(t) >= desde && fechaDe(t) <= hasta);

/** Horas del rango: solo lo que ya terminó (una reunión de la semana que viene todavía no se trabajó). */
export function horasDelRango(turnos: TurnoReporte[], desde: string, hasta: string, ahora: Date, criterio?: CriterioHoras): number {
  return horasTrabajadas(
    delRango(turnos, desde, hasta).filter((t) => new Date(t.fin) <= ahora),
    criterio,
  );
}

/** Lo que falta pagar de cada cargo, imputando los pagos de cada tutor por separado (FIFO). */
export function pendientesPorCargo({
  cargos,
  pagos,
}: {
  cargos: Pick<CargoReporte, "id" | "tutor_id" | "fecha" | "monto_gs">[];
  pagos: PagoReporte[];
}): { fecha: string; pendiente: number }[] {
  const fechas = new Map(cargos.map((c) => [c.id, c.fecha]));
  const tutores = new Set([...cargos, ...pagos].map((x) => x.tutor_id));
  return [...tutores].flatMap((tutor) =>
    imputarPagos({
      cargos: cargos.filter((c) => c.tutor_id === tutor),
      pagos: pagos.filter((p) => p.tutor_id === tutor),
    }).map((i) => ({ fecha: fechas.get(i.cargo_id)!, pendiente: i.pendiente })),
  );
}

/**
 * Pendiente = lo generado en el rango que todavía no se pagó. No usa `montoPeriodo`: ahí un ajuste
 * negativo restaría dos veces, porque la imputación ya lo cuenta como crédito.
 */
export function pendienteDelRango(pendientes: { fecha: string; pendiente: number }[], desde: string, hasta: string): number {
  return pendientes.filter((p) => p.fecha >= desde && p.fecha <= hasta).reduce((s, p) => s + p.pendiente, 0);
}

export function generadoPorDia(cargos: Pick<Cargo, "fecha" | "monto_gs">[], fechas: string[]): { fecha: string; monto: number }[] {
  return fechas.map((fecha) => ({ fecha, monto: generado(cargos, fecha, fecha) }));
}

/**
 * Turnos `agendado` del mes que generan cobro. Desde hoy en adelante son "los que quedan"; los de días
 * pasados están sin marcar y no entran en la proyección. Un paciente sin tarifa no frena el reporte:
 * se saltea y se cuenta, para avisar.
 */
export function montosAgendadosRestantes({
  turnos,
  tarifas,
  mes,
  hoy,
}: {
  turnos: TurnoReporte[];
  tarifas: Tarifa[];
  mes: string;
  hoy: string;
}): { restantes: { fecha: string; monto: number }[]; sinMarcar: number; sinTarifa: number } {
  const restantes: { fecha: string; monto: number }[] = [];
  let sinMarcar = 0;
  let sinTarifa = 0;
  for (const t of delRango(turnos, mes, finDeMes(mes))) {
    if (t.clase !== "turno" || t.estado !== "agendado" || !t.tipoTurno?.genera_cobro || !t.paciente) continue;
    const fecha = fechaDe(t);
    if (fecha < hoy) {
      sinMarcar++;
      continue;
    }
    try {
      restantes.push({ fecha, monto: montoBase({ tipoTurno: t.tipoTurno, paciente: t.paciente, tarifas }).monto });
    } catch {
      sinTarifa++;
    }
  }
  return { restantes, sinMarcar, sinTarifa };
}

/** Tasa del mes: mira los meses calendario anteriores. Solo turnos con cargo (un tipo sin cobro no es una ausencia). */
export function tasaDelMes({
  turnos,
  cargos,
  mes,
  criterio = CRITERIO_AUSENCIAS,
}: {
  turnos: TurnoReporte[];
  cargos: Pick<CargoReporte, "turno_id" | "monto_gs">[];
  mes: string;
  criterio?: CriterioAusencias;
}): number {
  const montos = new Map(cargos.filter((c) => c.turno_id).map((c) => [c.turno_id!, c.monto_gs]));
  const historia = delRango(turnos, inicioDeMes(mes, -criterio.mesesHistoria), sumarDias(mes, -1))
    .filter((t) => t.clase === "turno" && montos.has(t.id))
    .map((t) => ({ estado: t.estado, monto_cargo: montos.get(t.id)! }));
  return tasaAusenciasSinCobro(historia, criterio);
}

export type PuntoMes = {
  fecha: string;
  /** Generado acumulado; null en los días que todavía no pasaron. */
  real: number | null;
  /** Línea punteada: arranca en hoy y llega a la proyección; null si no corresponde. */
  proyeccion: number | null;
};

/** Generado acumulado día a día y proyección hasta fin de mes. El último punto da igual que `proyeccionMes`. */
export function serieMes({
  mes,
  hoy,
  cargos,
  restantes,
  tasa,
}: {
  mes: string;
  hoy: string;
  cargos: Pick<Cargo, "fecha" | "monto_gs">[];
  restantes: { fecha: string; monto: number }[];
  tasa: number;
}): PuntoMes[] {
  const fin = finDeMes(mes);
  return fechasEntre(mes, fin).map((fecha) => {
    const acumulado = generado(cargos, mes, fecha);
    const real = fecha <= hoy ? acumulado : null;
    if (hoy > fin || fecha < hoy) return { fecha, real, proyeccion: null };
    if (fecha === hoy) return { fecha, real, proyeccion: acumulado };
    const montosBaseAgendados = restantes.filter((r) => r.fecha <= fecha).map((r) => r.monto);
    return { fecha, real, proyeccion: proyeccionMes({ generado: acumulado, montosBaseAgendados, tasa }) };
  });
}

export type MesComparado = { mes: string; generado: number; cobrado: number; pendiente: number; horas: number };

/** Los 6 meses que terminan en `mes`, del más viejo al más nuevo. */
export function comparacionMeses({
  mes,
  cargos,
  pagos,
  pendientes,
  turnos,
  ahora,
}: {
  mes: string;
  cargos: Pick<Cargo, "fecha" | "monto_gs">[];
  pagos: Pick<Pago, "fecha" | "monto_gs">[];
  pendientes: { fecha: string; pendiente: number }[];
  turnos: TurnoReporte[];
  ahora: Date;
}): MesComparado[] {
  return [-5, -4, -3, -2, -1, 0].map((n) => {
    const desde = inicioDeMes(mes, n);
    const hasta = finDeMes(desde);
    return {
      mes: desde,
      generado: generado(cargos, desde, hasta),
      cobrado: cobrado(pagos, desde, hasta),
      pendiente: pendienteDelRango(pendientes, desde, hasta),
      horas: horasDelRango(turnos, desde, hasta, ahora),
    };
  });
}

export type DiaSemanaReporte = { fecha: string; monto: number };

/**
 * Días de la semana: lunes a viernes, sábado o domingo si tienen horario, y cualquier día que haya
 * generado algo. Así el total siempre da igual a la suma de los días que se ven.
 */
export function semanaReporte({
  semana,
  cargos,
  diasConHorario,
}: {
  semana: string;
  cargos: Pick<Cargo, "fecha" | "monto_gs">[];
  diasConHorario: number[];
}): { dias: DiaSemanaReporte[]; total: number } {
  const visibles = diasVisibles(diasConHorario);
  const dias = generadoPorDia(cargos, fechasEntre(semana, sumarDias(semana, 6))).filter(
    (d) => visibles.includes(diaSemana(d.fecha)) || d.monto !== 0,
  );
  return { dias, total: dias.reduce((s, d) => s + d.monto, 0) };
}

export type FilaDetalle = {
  id: string;
  /** "HH:MM"; null si es un cargo sin turno (un ajuste). */
  hora: string | null;
  paciente: string | null;
  tipo: string;
  estado: EstadoTurno | null;
  /** null: el turno no tiene cargo (sin marcar, o un tipo que no genera cobro). */
  monto: number | null;
};

/**
 * Lo que se ve al tocar un día: los turnos con paciente y su monto. Los reservados y ocupados no van
 * (su título es texto libre). Un cargo sin turno se muestra sin su concepto, para que la suma del día cierre.
 */
export function detallePorDia(
  turnos: Pick<TurnoAgenda, "id" | "clase" | "estado" | "fecha" | "inicio" | "titulo" | "tipo">[],
  cargos: Pick<CargoReporte, "id" | "fecha" | "monto_gs" | "turno_id" | "tipo">[],
): Record<string, FilaDetalle[]> {
  const conTurno = turnos.filter((t) => t.clase === "turno");
  const ids = new Set(conTurno.map((t) => t.id));
  const montos = new Map(cargos.filter((c) => c.turno_id).map((c) => [c.turno_id!, c.monto_gs]));
  const detalle: Record<string, FilaDetalle[]> = {};
  const agregar = (fecha: string, fila: FilaDetalle) => (detalle[fecha] ??= []).push(fila);

  for (const t of conTurno) {
    agregar(t.fecha, {
      id: t.id,
      hora: t.inicio,
      paciente: t.titulo,
      tipo: t.tipo ?? "Sesión",
      estado: t.estado,
      monto: montos.get(t.id) ?? null,
    });
  }
  for (const c of cargos) {
    if (c.turno_id && ids.has(c.turno_id)) continue;
    agregar(c.fecha, { id: c.id, hora: null, paciente: null, tipo: c.tipo === "ajuste" ? "Ajuste" : "Sesión", estado: null, monto: c.monto_gs });
  }
  return detalle;
}

export type Reporte = {
  mes: string;
  hoy: string;
  esMesActual: boolean;
  generadoHoy: number;
  generadoMes: number;
  /** null en los meses que ya terminaron. */
  proyeccion: number | null;
  cobradoMes: number;
  pendienteMes: number;
  horasMes: number;
  tasa: number;
  sinMarcar: number;
  sinTarifa: number;
  dias: { fecha: string; monto: number }[];
  serie: PuntoMes[];
  comparacion: MesComparado[];
  semana: { lunes: string; dias: DiaSemanaReporte[]; total: number; detalle: Record<string, FilaDetalle[]> };
};

/** Junta todo lo que muestran la pantalla y el Excel. Lo que devuelve va al navegador: nada de motivos. */
export function armarReporte({
  mes,
  semana,
  hoy,
  ahora,
  cargos,
  pagos,
  turnos,
  tarifas,
  diasConHorario,
  turnosSemana,
}: {
  mes: string;
  semana: string;
  hoy: string;
  ahora: Date;
  cargos: CargoReporte[];
  pagos: PagoReporte[];
  turnos: TurnoReporte[];
  tarifas: Tarifa[];
  diasConHorario: number[];
  turnosSemana: Parameters<typeof detallePorDia>[0];
}): Reporte {
  const fin = finDeMes(mes);
  const esMesActual = mes === inicioDeMes(hoy);
  const generadoMes = generado(cargos, mes, fin);
  const pendientes = pendientesPorCargo({ cargos, pagos });
  const { restantes, sinMarcar, sinTarifa } = montosAgendadosRestantes({ turnos, tarifas, mes, hoy });
  const tasa = tasaDelMes({ turnos, cargos, mes });
  const domingo = sumarDias(semana, 6);

  return {
    mes,
    hoy,
    esMesActual,
    generadoHoy: generado(cargos, hoy, hoy),
    generadoMes,
    proyeccion: esMesActual ? proyeccionMes({ generado: generadoMes, montosBaseAgendados: restantes.map((r) => r.monto), tasa }) : null,
    cobradoMes: cobrado(pagos, mes, fin),
    pendienteMes: pendienteDelRango(pendientes, mes, fin),
    horasMes: horasDelRango(turnos, mes, fin, ahora),
    tasa,
    sinMarcar,
    sinTarifa,
    dias: generadoPorDia(cargos, fechasEntre(mes, fin)),
    serie: serieMes({ mes, hoy, cargos, restantes, tasa }),
    comparacion: comparacionMeses({ mes, cargos, pagos, pendientes, turnos, ahora }),
    semana: {
      lunes: semana,
      ...semanaReporte({ semana, cargos, diasConHorario }),
      detalle: detallePorDia(
        turnosSemana,
        cargos.filter((c) => c.fecha >= semana && c.fecha <= domingo),
      ),
    },
  };
}

// ---------------------------------------------------------------------
// Parámetros de la dirección y textos
// ---------------------------------------------------------------------

/** "2026-11" → "2026-11-01". null si está mal escrito o es un mes que todavía no llegó. */
export function mesValido(valor: unknown, hoy: string): string | null {
  if (typeof valor !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(valor)) return null;
  const mes = `${valor}-01`;
  return mes <= inicioDeMes(hoy) ? mes : null;
}

/** Cualquier fecha real → el lunes de esa semana. Si no es válida, el lunes de la semana de hoy. */
export function semanaValida(valor: unknown, hoy: string): string {
  if (typeof valor !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(valor) || sumarDias(valor, 0) !== valor) return lunesDe(hoy);
  return lunesDe(valor);
}

/** "2026-11-01" → "2026-11", como va en la dirección. */
export const paramMes = (mes: string) => mes.slice(0, 7);

/** 32,25 horas → "32 h 15 min". */
export function textoHoras(horas: number): string {
  const minutos = Math.round(horas * 60);
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** "2026-11-01" → "nov". */
export const mesCorto = (mes: string) => MESES[Number(mes.slice(5, 7)) - 1].slice(0, 3);

/** Marcas redondas del eje, de 0 hasta cubrir `maximo`, con 3 a 5 marcas. */
export function marcasEje(maximo: number): number[] {
  if (maximo <= 0) return [0, 100_000];
  const base = 10 ** Math.floor(Math.log10(maximo));
  const paso = [0.2, 0.5, 1, 2, 5].map((n) => n * base).find((p) => Math.ceil(maximo / p) <= 4) ?? base * 10;
  return Array.from({ length: Math.ceil(maximo / paso) + 1 }, (_, i) => Math.round(i * paso));
}

/** Monto corto para el eje: "500 mil", "2,5 M". El monto exacto se ve con `formatoGs`. */
export function montoCorto(monto: number): string {
  if (Math.abs(monto) >= 1_000_000) return `${String(Math.round(monto / 100_000) / 10).replace(".", ",")} M`;
  if (Math.abs(monto) >= 1_000) return `${Math.round(monto / 1_000)} mil`;
  return String(monto);
}
