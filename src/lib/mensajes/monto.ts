// Mensaje de "Monto del período" (docs/mensajes.md y docs/reglas-cobro.md sección 6). Funciones puras.
// Lo usan "Mensajes de hoy" y la cuenta del tutor, así los dos dicen lo mismo.
// OJO regla de oro 7: las líneas del detalle salen del estado y del tipo de turno. Nunca del motivo de
// una excepción, del motivo de un ajuste ni del concepto: son texto libre y pueden tener datos clínicos.

import { inicioDeMes, lunesDe, sumarDias } from "@/lib/agenda/calendario";
import { formatoGs } from "@/lib/cobro/formato";
import { montoPeriodo, rangoMes, rangoSemana, type Rango } from "@/lib/cobro/periodo";
import { diasEntre, imputarPagos, type Imputacion } from "@/lib/cobro/saldo";
import type { PlanCobro } from "@/lib/cobro/tipos";
import { MESES } from "@/lib/pacientes/fecha";
import { nombrePila, rellenar, unirNombres } from "./plantillas";
import type { MensajeListo } from "./tipos";

/** Un cargo con lo que hace falta para su línea del detalle. */
export type CargoDetalle = {
  id: string;
  fecha: string;
  monto_gs: number;
  /** Nombre del paciente; null en un ajuste sin paciente. */
  paciente: string | null;
  /** Estado guardado en el snapshot del cargo; null en un ajuste. */
  estado: string | null;
  /** Nombre del tipo de turno; null en un ajuste. */
  tipo: string | null;
};

/** "2026-10-03" → "03/10". */
const diaYMes = (fecha: string) => `${fecha.slice(8, 10)}/${fecha.slice(5, 7)}`;

/** Qué se hizo en esa fecha, en palabras para la familia. */
function queFue(cargo: Pick<CargoDetalle, "estado" | "tipo">, horasAvisoMinimas: number): string {
  switch (cargo.estado) {
    case "aviso_tardio":
      return `Canceló con menos de ${horasAvisoMinimas} h`;
    case "ausente_sin_aviso":
      return "No vino";
    case "ausente_con_aviso":
      return "Canceló con aviso";
    case "cancelado_profesional":
      return "Cancelada por la profesional";
    case "reprogramado":
      return "Reprogramada";
    case "presente":
      return cargo.tipo?.trim() || "Sesión";
    default:
      return cargo.tipo?.trim() || "Ajuste";
  }
}

/** "• 03/10 Tomi – Sesión – Gs. 290.000" */
export function lineaDetalle(cargo: CargoDetalle, horasAvisoMinimas: number): string {
  const quien = cargo.paciente ? `${nombrePila(cargo.paciente)} – ` : "";
  return `• ${diaYMes(cargo.fecha)} ${quien}${queFue(cargo, horasAvisoMinimas)} – ${formatoGs(cargo.monto_gs)}`;
}

/**
 * El detalle por sesión de un período: las líneas suman el total del mensaje.
 * Un reprogramado en Gs. 0 no va (la sesión nueva ya aparece en su fecha) y un ajuste negativo tampoco:
 * es un crédito, igual que un pago, y entra en "Ya pagado".
 */
export function textoDetalle({
  cargos,
  imputacion,
  desde,
  hasta,
  horasAvisoMinimas,
}: Rango & {
  cargos: CargoDetalle[];
  imputacion: Pick<Imputacion, "cargo_id" | "pagado">[];
  horasAvisoMinimas: number;
}): string {
  const delPeriodo = cargos.filter((c) => c.fecha >= desde && c.fecha <= hasta && c.monto_gs >= 0);
  const pagado = new Map(imputacion.map((i) => [i.cargo_id, i.pagado]));
  const yaPagado = delPeriodo.reduce((s, c) => s + (pagado.get(c.id) ?? 0), 0);
  const lineas = delPeriodo
    .filter((c) => !(c.estado === "reprogramado" && c.monto_gs === 0))
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || (a.paciente ?? "").localeCompare(b.paciente ?? "", "es"))
    .map((c) => lineaDetalle(c, horasAvisoMinimas));
  if (yaPagado > 0) lineas.push(`• Ya pagado – ${formatoGs(-yaPagado)}`);
  return lineas.join("\n");
}

export type TextosMonto = { total: number; texto: string; textoConDetalle: string };

/**
 * Los dos textos del mensaje: solo el total y con el detalle. Null si el total es 0 o a favor (no se
 * manda). Si la plantilla no tiene {detalle}, las líneas van al final, para que el interruptor siempre
 * haga algo (la plantilla por defecto no lo tiene).
 */
export function armarMonto({
  plantilla,
  tutor,
  paciente,
  periodo,
  datosPago,
  cargos,
  imputacion,
  rango,
  horasAvisoMinimas,
}: {
  plantilla: string;
  /** Nombre de pila del tutor. */
  tutor: string;
  /** Nombres de pila ya unidos ("Tomi y Sofi"). */
  paciente: string;
  periodo: string;
  datosPago: string | null;
  cargos: CargoDetalle[];
  imputacion: Imputacion[];
  rango: Rango;
  horasAvisoMinimas: number;
}): TextosMonto | null {
  const total = montoPeriodo({ cargos, imputacion, ...rango });
  if (total <= 0) return null;
  const valores = { tutor, paciente, periodo, total: formatoGs(total), datos_pago: datosPago ?? "" };
  const detalle = textoDetalle({ cargos, imputacion, ...rango, horasAvisoMinimas });
  const texto = rellenar(plantilla, { ...valores, detalle: "" });
  return {
    total,
    texto,
    textoConDetalle: plantilla.includes("{detalle}") ? rellenar(plantilla, { ...valores, detalle }) : `${texto}\n\n${detalle}`,
  };
}

/** Semana ISO "AAAA-Www" de una fecha (referencia del monto semanal). */
export function semanaIso(fecha: string): string {
  const jueves = sumarDias(lunesDe(fecha), 3);
  const anio = jueves.slice(0, 4);
  const semana = Math.floor(diasEntre(`${anio}-01-01`, jueves) / 7) + 1;
  return `${anio}-W${String(semana).padStart(2, "0")}`;
}

/** "17/11" o "30/10" */
const diaMes = (fecha: string) => `${Number(fecha.slice(8, 10))}/${Number(fecha.slice(5, 7))}`;

/** "la semana del 2 al 6/11" (o "del 30/11 al 4/12"). Llega al menos hasta el viernes. */
export function textoSemana(lunes: string, ultimo: string): string {
  const viernes = sumarDias(lunes, 4);
  const hasta = ultimo > viernes ? ultimo : viernes;
  const desde = lunes.slice(5, 7) === hasta.slice(5, 7) ? String(Number(lunes.slice(8, 10))) : diaMes(lunes);
  return `la semana del ${desde} al ${diaMes(hasta)}`;
}

/** "2026-11-06" → "noviembre". */
export const textoMes = (fecha: string) => MESES[Number(fecha.slice(5, 7)) - 1];

// ---------------------------------------------------------------------
// Monto desde la cuenta del tutor
// ---------------------------------------------------------------------

export type IdPeriodo = "semana" | "mes" | "mes_pasado";

export type OpcionPeriodo = {
  id: IdPeriodo;
  /** Para el selector. */
  titulo: string;
  rango: Rango;
  /** La misma de "Mensajes de hoy": mandarlo acá también lo tacha allá. */
  referencia: string;
  /** Lo que va en {periodo}. */
  periodo: string;
};

/** Los períodos que se pueden mandar desde la cuenta: esta semana, este mes y el mes pasado. */
export function opcionesPeriodo(hoy: string): OpcionPeriodo[] {
  const semana = rangoSemana(hoy);
  const mes = rangoMes(hoy);
  const pasado = inicioDeMes(hoy, -1);
  return [
    { id: "semana", titulo: "Esta semana", rango: semana, referencia: semanaIso(hoy), periodo: textoSemana(semana.desde, hoy) },
    { id: "mes", titulo: "Este mes", rango: mes, referencia: hoy.slice(0, 7), periodo: textoMes(hoy) },
    { id: "mes_pasado", titulo: "Mes pasado", rango: rangoMes(pasado), referencia: pasado.slice(0, 7), periodo: textoMes(pasado) },
  ];
}

export const AVISO_PERIODO_SIN_MARCAR = "Hay turnos de este período sin marcar: el total puede cambiar";

export type MensajeMonto = MensajeListo & { textoConDetalle: string };

export type MontoDeTutor = OpcionPeriodo & {
  /** Lo que falta pagar del período; 0 si no hay mensaje. */
  total: number;
  /** Null si no hay nada para cobrar en ese período. */
  mensaje: MensajeMonto | null;
  enviado: boolean;
  aviso?: string;
};

/**
 * El mensaje de cada período para un tutor. Es el total de toda la familia, sea cual sea el plan de cada
 * hijo: acá lo pide la profesional a mano. (La bandeja, en cambio, separa por plan.)
 */
export function montosDeTutor({
  hoy,
  tutor,
  plantilla,
  datosPago,
  horasAvisoMinimas,
  cargos,
  pagos,
  fechasSinMarcar,
  referenciasEnviadas,
}: {
  hoy: string;
  tutor: Pick<MensajeListo, "tutor" | "telefono"> & { id: string; nombre: string };
  plantilla: string;
  datosPago: string | null;
  horasAvisoMinimas: number;
  cargos: CargoDetalle[];
  pagos: { id: string; fecha: string; monto_gs: number }[];
  /** Días de turnos de la familia que siguen `agendado`. */
  fechasSinMarcar: string[];
  referenciasEnviadas: string[];
}): MontoDeTutor[] {
  const imputacion = imputarPagos({ cargos, pagos });
  return opcionesPeriodo(hoy).map((opcion) => {
    const { desde, hasta } = opcion.rango;
    const cobrados = cargos.filter((c) => c.fecha >= desde && c.fecha <= hasta && c.monto_gs > 0);
    const nombres = [...cobrados].sort((a, b) => a.fecha.localeCompare(b.fecha)).flatMap((c) => (c.paciente ? [nombrePila(c.paciente)] : []));
    const textos = armarMonto({
      plantilla,
      tutor: nombrePila(tutor.nombre),
      paciente: unirNombres(nombres),
      periodo: opcion.periodo,
      datosPago,
      cargos,
      imputacion,
      rango: opcion.rango,
      horasAvisoMinimas,
    });
    const sinMarcar = fechasSinMarcar.some((f) => f >= desde && f <= hasta && f <= hoy);
    return {
      ...opcion,
      total: textos?.total ?? 0,
      mensaje: textos && {
        clave: "monto_periodo",
        referencia: opcion.referencia,
        tutorId: tutor.id,
        tutor: tutor.tutor,
        texto: textos.texto,
        textoConDetalle: textos.textoConDetalle,
        telefono: tutor.telefono,
      },
      enviado: referenciasEnviadas.includes(opcion.referencia),
      ...(sinMarcar ? { aviso: AVISO_PERIODO_SIN_MARCAR } : {}),
    };
  });
}

/** Qué período mostrar primero: el del plan de la familia o, si ahí no hay nada, uno con algo para cobrar. */
export function periodoInicial(montos: Pick<MontoDeTutor, "id" | "mensaje">[], planes: PlanCobro[]): IdPeriodo {
  const preferido: IdPeriodo = planes.includes("semanal") && !planes.includes("mensual") ? "semana" : "mes";
  const orden: IdPeriodo[] = [preferido, "mes_pasado", "mes", "semana"];
  return orden.find((id) => montos.some((m) => m.id === id && m.mensaje)) ?? preferido;
}
