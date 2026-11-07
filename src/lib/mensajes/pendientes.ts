// "Mensajes de hoy" (docs/mensajes.md): qué mensajes sugerir hoy. Función pura con tests.
// Usa el motor de cobro (src/lib/cobro) para montos y atrasos; no guarda saldos (regla de oro 2).
// OJO regla de oro 7: solo nombres de pila, días, horas y montos. Nada clínico.

import { proximoDiaDeAtencion } from "@/lib/agenda/atencion";
import type { Bloqueo, Tramo } from "@/lib/agenda/bloques";
import { sumarDias } from "@/lib/agenda/calendario";
import { textoMeses } from "@/lib/cobro/facturar";
import { formatoGs } from "@/lib/cobro/formato";
import { rangoMes, rangoSemana } from "@/lib/cobro/periodo";
import { atraso, imputarPagos, vencimiento } from "@/lib/cobro/saldo";
import type { PlanCobro } from "@/lib/cobro/tipos";
import { armarMonto, semanaIso, textoMes, textoSemana } from "./monto";
import {
  actualizarRecordatorio,
  nombrePila,
  rellenar,
  textoCuando,
  textoDiaMensaje,
  textoHoras,
  unirNombres,
  type Clave,
} from "./plantillas";
import type { MensajeListo } from "./tipos";

export type TutorPendientes = { id: string; nombre: string; apellido: string | null; telefono_wa: string | null };
export type PacientePendientes = { id: string; nombre: string; responsable_pago_id: string | null; plan_cobro: PlanCobro };
/** Turno con fecha y hora de Asunción ("AAAA-MM-DD", "HH:MM"). */
export type TurnoPendientes = { id: string; clase: string; estado: string; paciente_id: string | null; fecha: string; hora: string };
/** Cargo con lo que necesitan el vencimiento (si su tipo cobra en el momento) y el detalle (estado y tipo). */
export type CargoPendientes = {
  id: string;
  tutor_id: string;
  paciente_id: string | null;
  fecha: string;
  monto_gs: number;
  cobra_en_el_momento: boolean;
  /** Estado del snapshot del cargo; null en un ajuste. */
  estado: string | null;
  /** Nombre del tipo de turno; null en un ajuste. */
  tipo: string | null;
};
export type PagoPendientes = { id: string; tutor_id: string; fecha: string; monto_gs: number };
/** Lo ya mandado; `fecha` = día de Asunción de `enviado_en`. */
export type EnviadoPendientes = { clave: string; referencia: string; tutor_id: string | null; fecha: string };

export type DatosPendientes = {
  plantillas: Record<Clave, string>;
  datosPago: string | null;
  diaLimitePago: number;
  horasAvisoMinimas: number;
  tramos: Pick<Tramo, "dia_semana">[];
  bloqueos: Bloqueo[];
  tutores: TutorPendientes[];
  pacientes: PacientePendientes[];
  /** Turnos de este mes, esta semana y el próximo día de atención (ver rangoDeTurnos). */
  turnos: TurnoPendientes[];
  /** Cargos y pagos completos de cada tutor de `tutoresConCuentaNecesaria` (la imputación FIFO necesita toda su historia). */
  cargos: CargoPendientes[];
  pagos: PagoPendientes[];
  enviados: EnviadoPendientes[];
};

export type FilaPendiente = MensajeListo & {
  /** Nombres de pila de los pacientes ("Tomi y Sofi"), para mostrar. */
  pacientes: string;
  /** Ya se mandó: sale tachada. */
  enviado: boolean;
  /** Algo para revisar antes de mandarlo. */
  aviso?: string;
  /** Solo en los montos: el mismo mensaje con el detalle por sesión (interruptor "Agregar detalle"). */
  textoConDetalle?: string;
};

export type Pendientes = {
  /** Día de los recordatorios (el próximo día de atención), o null. */
  proximoDia: string | null;
  recordatorios: FilaPendiente[];
  montos: FilaPendiente[];
  pagos: FilaPendiente[];
};

/** Estados que liberan el turno sin cobro: no cuentan para "el último turno del período". */
const NO_CUENTAN = ["reprogramado", "cancelado_profesional", "ausente_con_aviso"];

export const AVISO_SIN_MARCAR = "Marcá la asistencia de hoy antes de mandarlo";

/** Un recordatorio de pago se sugiere como máximo una vez cada 7 días por tutor. */
export const DIAS_ENTRE_RECORDATORIOS_PAGO = 7;

/** Qué turnos hay que traer de la base: esta semana, este mes y el próximo día de atención. */
export function rangoDeTurnos(hoy: string, proximoDia: string | null): { desde: string; hasta: string } {
  const mes = rangoMes(hoy);
  const semana = rangoSemana(hoy);
  const fechas = [mes.desde, mes.hasta, semana.desde, semana.hasta, ...(proximoDia ? [proximoDia] : [])].sort();
  return { desde: fechas[0], hasta: fechas[fechas.length - 1] };
}

/**
 * De qué tutores hay que leer cargos y pagos para armar los mensajes de hoy. El resto no cambia el resultado:
 * - con saldo <= 0 la imputación FIFO no deja nada pendiente, así que no hay atraso;
 * - el monto del período solo sale si hoy es el último turno, y eso exige un turno hoy.
 */
export function tutoresConCuentaNecesaria(
  hoy: string,
  {
    saldos,
    turnos,
    pacientes,
  }: {
    saldos: { tutor_id: string; saldo_gs: number }[];
    turnos: Pick<TurnoPendientes, "paciente_id" | "fecha">[];
    pacientes: Pick<PacientePendientes, "id" | "responsable_pago_id">[];
  },
): string[] {
  const ids = new Set(saldos.filter((s) => s.saldo_gs > 0).map((s) => s.tutor_id));
  const responsable = new Map(pacientes.map((p) => [p.id, p.responsable_pago_id]));
  for (const t of turnos) {
    const tutorId = t.fecha === hoy && t.paciente_id ? responsable.get(t.paciente_id) : null;
    if (tutorId) ids.add(tutorId);
  }
  return [...ids];
}

const nombreCompleto = (t: TutorPendientes) => `${t.nombre} ${t.apellido ?? ""}`.trim();
const porNombre = (a: FilaPendiente, b: FilaPendiente) => a.tutor.localeCompare(b.tutor, "es");

/**
 * Los mensajes para hoy, en tres grupos:
 * - recordatorios: turnos agendados del próximo día de atención, uno por responsable de pago;
 * - montos: el día del último turno del mes (plan mensual) o de la semana (plan semanal) de la familia;
 * - pagos: familias en atraso (vencimiento + atraso del motor), máximo una vez por semana.
 */
export function pendientesDelDia(hoy: string, datos: DatosPendientes): Pendientes {
  const tutores = new Map(datos.tutores.map((t) => [t.id, t]));
  const pacientes = new Map(datos.pacientes.map((p) => [p.id, p]));
  const enviados = new Set(datos.enviados.map((e) => `${e.clave}|${e.referencia}|${e.tutor_id}`));

  function fila(
    clave: Clave,
    referencia: string,
    tutor: TutorPendientes,
    nombresPacientes: string[],
    texto: string,
    aviso?: string,
  ): FilaPendiente {
    return {
      clave,
      referencia,
      tutorId: tutor.id,
      tutor: nombreCompleto(tutor),
      pacientes: unirNombres(nombresPacientes),
      texto,
      telefono: tutor.telefono_wa,
      enviado: enviados.has(`${clave}|${referencia}|${tutor.id}`),
      ...(aviso ? { aviso } : {}),
    };
  }

  // Turnos con paciente y responsable de pago, agrupados por tutor.
  const turnosConTutor = datos.turnos.flatMap((t) => {
    const paciente = t.clase === "turno" && t.paciente_id ? pacientes.get(t.paciente_id) : undefined;
    const tutor = paciente?.responsable_pago_id ? tutores.get(paciente.responsable_pago_id) : undefined;
    return paciente && tutor ? [{ ...t, paciente, tutor }] : [];
  });
  type TurnoConTutor = (typeof turnosConTutor)[number];
  const agrupar = (lista: TurnoConTutor[]) => {
    const grupos = new Map<string, TurnoConTutor[]>();
    for (const t of lista) grupos.set(t.tutor.id, [...(grupos.get(t.tutor.id) ?? []), t]);
    return grupos;
  };
  const pilas = (lista: TurnoConTutor[]) =>
    [...lista].sort((a, b) => a.fecha.localeCompare(b.fecha) || a.hora.localeCompare(b.hora)).map((t) => nombrePila(t.paciente.nombre));

  // 1. Recordatorios del próximo día de atención.
  const proximoDia = proximoDiaDeAtencion(hoy, datos.tramos, datos.bloqueos);
  const recordatorios: FilaPendiente[] = [];
  if (proximoDia) {
    const plantilla = actualizarRecordatorio(datos.plantillas.recordatorio_sesion);
    const delDia = turnosConTutor.filter((t) => t.fecha === proximoDia && t.estado === "agendado");
    for (const lista of agrupar(delDia).values()) {
      const tutor = lista[0].tutor;
      const nombres = pilas(lista);
      const texto = rellenar(plantilla, {
        tutor: nombrePila(tutor.nombre),
        paciente: unirNombres(nombres),
        cuando: textoCuando(proximoDia, hoy),
        dia: textoDiaMensaje(proximoDia),
        hora: textoHoras(lista.map((t) => t.hora)),
      });
      recordatorios.push(fila("recordatorio_sesion", proximoDia, tutor, nombres, texto));
    }
    recordatorios.sort((a, b) => {
      const hora = (f: FilaPendiente) => delDia.filter((t) => t.tutor.id === f.tutorId).map((t) => t.hora).sort()[0] ?? "";
      return hora(a).localeCompare(hora(b)) || porNombre(a, b);
    });
  }

  // Cargos y pagos de cada tutor, con la imputación FIFO de toda su historia.
  const cargosDe = new Map<string, CargoPendientes[]>();
  for (const c of datos.cargos) cargosDe.set(c.tutor_id, [...(cargosDe.get(c.tutor_id) ?? []), c]);
  const pagosDe = new Map<string, PagoPendientes[]>();
  for (const p of datos.pagos) pagosDe.set(p.tutor_id, [...(pagosDe.get(p.tutor_id) ?? []), p]);
  const imputacionDe = (tutorId: string) => imputarPagos({ cargos: cargosDe.get(tutorId) ?? [], pagos: pagosDe.get(tutorId) ?? [] });

  // 2. Montos del período: hoy es el día del último turno del mes (o de la semana) de la familia.
  const montos: FilaPendiente[] = [];
  const queCuentan = turnosConTutor.filter((t) => !NO_CUENTAN.includes(t.estado));
  for (const plan of ["mensual", "semanal"] as const) {
    const rango = plan === "mensual" ? rangoMes(hoy) : rangoSemana(hoy);
    const delPeriodo = queCuentan.filter((t) => t.paciente.plan_cobro === plan && t.fecha >= rango.desde && t.fecha <= rango.hasta);
    for (const lista of agrupar(delPeriodo).values()) {
      const ultimo = lista.map((t) => t.fecha).sort().at(-1)!;
      if (ultimo !== hoy) continue;
      const tutor = lista[0].tutor;
      // Los cargos de los hijos con este plan (y los ajustes sin paciente, en el plan mensual).
      const deEstePlan = (cargosDe.get(tutor.id) ?? []).filter((c) =>
        c.paciente_id ? pacientes.get(c.paciente_id)?.plan_cobro === plan : plan === "mensual",
      );
      const nombres = [...new Set(pilas(lista))];
      const textos = armarMonto({
        plantilla: datos.plantillas.monto_periodo,
        tutor: nombrePila(tutor.nombre),
        paciente: unirNombres(nombres),
        periodo: plan === "mensual" ? textoMes(hoy) : textoSemana(rango.desde, ultimo),
        datosPago: datos.datosPago,
        cargos: deEstePlan.map((c) => ({ ...c, paciente: (c.paciente_id && pacientes.get(c.paciente_id)?.nombre) || null })),
        imputacion: imputacionDe(tutor.id),
        rango,
        horasAvisoMinimas: datos.horasAvisoMinimas,
      });
      if (!textos) continue;

      // Si hoy hay turnos de la familia sin marcar, falta su cargo: el total puede cambiar.
      const sinMarcar = turnosConTutor.some((t) => t.tutor.id === tutor.id && t.fecha === hoy && t.estado === "agendado");
      const referencia = plan === "mensual" ? hoy.slice(0, 7) : semanaIso(hoy);
      montos.push({
        ...fila("monto_periodo", referencia, tutor, nombres, textos.texto, sinMarcar ? AVISO_SIN_MARCAR : undefined),
        textoConDetalle: textos.textoConDetalle,
      });
    }
  }
  montos.sort(porNombre);

  // 3. Pagos atrasados.
  const pagos: FilaPendiente[] = [];
  const desdeBloqueo = sumarDias(hoy, -(DIAS_ENTRE_RECORDATORIOS_PAGO - 1));
  for (const [tutorId, cargos] of cargosDe) {
    const tutor = tutores.get(tutorId);
    if (!tutor) continue;
    // Uno mandado en los 6 días anteriores: esta semana no se vuelve a sugerir.
    const recientes = datos.enviados.filter((e) => e.clave === "recordatorio_pago" && e.tutor_id === tutorId);
    if (recientes.some((e) => e.fecha >= desdeBloqueo && e.fecha < hoy)) continue;

    const porId = new Map(cargos.map((c) => [c.id, c]));
    const filas = imputacionDe(tutorId).map((i) => {
      const cargo = porId.get(i.cargo_id)!;
      const plan = (cargo.paciente_id && pacientes.get(cargo.paciente_id)?.plan_cobro) || "mensual";
      return {
        cargo,
        pendiente: i.pendiente,
        vencimiento: vencimiento({ fecha: cargo.fecha, plan, cobraEnElMomento: cargo.cobra_en_el_momento, diaLimitePago: datos.diaLimitePago }),
      };
    });
    if (!atraso({ cargos: filas, hoy }).enAtraso) continue;

    const vencidos = filas.filter((f) => f.pendiente > 0 && f.vencimiento < hoy);
    const total = vencidos.reduce((s, f) => s + f.pendiente, 0);
    const nombres = [
      ...new Set(vencidos.flatMap((f) => (f.cargo.paciente_id && pacientes.get(f.cargo.paciente_id)?.nombre) || []).map(nombrePila)),
    ];
    const texto = rellenar(datos.plantillas.recordatorio_pago, {
      tutor: nombrePila(tutor.nombre),
      paciente: unirNombres(nombres),
      periodo: textoMeses(vencidos.map((f) => f.cargo.fecha)),
      total: formatoGs(total),
      datos_pago: datos.datosPago ?? "",
    });
    pagos.push(fila("recordatorio_pago", hoy, tutor, nombres, texto));
  }
  pagos.sort(porNombre);

  return { proximoDia, recordatorios, montos, pagos };
}

/** Cuántos quedan sin mandar (para el contador del menú). */
export function cantidadSinEnviar(p: Pendientes): number {
  return [...p.recordatorios, ...p.montos, ...p.pagos].filter((f) => !f.enviado).length;
}
