import "server-only";

// Lecturas de mensajes. Pasan por RLS y además se filtran por el consultorio.
// No es "use server": son funciones del servidor que no puede llamar el navegador.

import { unstable_rethrow } from "next/navigation";
import { cache } from "react";

import { proximoDiaDeAtencion } from "@/lib/agenda/atencion";
import { sumarDias } from "@/lib/agenda/calendario";
import { obtenerHorario } from "@/lib/agenda/datos";
import { aHoraLocal, inicioDelDiaUtc } from "@/lib/agenda/turnos";
import { exigirConsultorio } from "@/lib/auth/servidor";
import { hoyEnAsuncion } from "@/lib/fechas";
import type { PlanCobro } from "@/lib/cobro/tipos";
import { esIdValido } from "@/lib/pacientes/datos";
import { leerTodo } from "@/lib/supabase/paginar";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { montosDeTutor, opcionesPeriodo, periodoInicial } from "./monto";
import { DIAS_ENTRE_RECORDATORIOS_PAGO, cantidadSinEnviar, pendientesDelDia, rangoDeTurnos, tutoresConCuentaNecesaria, type DatosPendientes } from "./pendientes";
import { CLAVES, PLANTILLAS_POR_DEFECTO, esClave, type Clave } from "./plantillas";
import type { MensajeListo } from "./tipos";
import { textoMensajeTurno } from "./turno";

type Supabase = Awaited<ReturnType<typeof crearClienteServidor>>;

/** Texto guardado de cada plantilla (o el de por defecto si falta o está vacío). */
export async function textosDePlantillas(supabase: Supabase, consultorioId: string): Promise<Record<Clave, string>> {
  const { data, error } = await supabase.from("plantillas_mensaje").select("clave, texto").eq("consultorio_id", consultorioId);
  if (error) throw new Error("No se pudieron leer las plantillas");
  const textos = { ...PLANTILLAS_POR_DEFECTO };
  for (const p of data ?? []) if (esClave(p.clave) && p.texto.trim()) textos[p.clave] = p.texto;
  return textos;
}

/** Plantillas para el editor de Configuración, en el orden de CLAVES. */
export async function listarPlantillas(): Promise<{ clave: Clave; texto: string }[]> {
  const consultorio = await exigirConsultorio();
  const supabase = await crearClienteServidor();
  const textos = await textosDePlantillas(supabase, consultorio.id);
  return CLAVES.map((clave) => ({ clave, texto: textos[clave] }));
}

/**
 * Mensaje de cambio o cancelación para la familia de un turno con paciente.
 * Va al responsable de pago. Si falta algo (sin paciente, sin responsable), null.
 * `turnoId` es el turno cuyo día y hora van en el texto (el nuevo, si se movió).
 */
export async function mensajeParaTurno(
  supabase: Supabase,
  consultorioId: string,
  turnoId: string,
  clave: "cambio_turno" | "cancelacion_turno",
): Promise<MensajeListo | null> {
  const { data: turno } = await supabase
    .from("turnos")
    .select("clase, inicio, pacientes!turnos_consultorio_id_paciente_id_fkey(nombre, responsable_pago_id)")
    .eq("consultorio_id", consultorioId)
    .eq("id", turnoId)
    .maybeSingle();
  const paciente = turno?.pacientes;
  if (!turno || turno.clase !== "turno" || !paciente?.responsable_pago_id) return null;

  const [{ data: tutor }, textos] = await Promise.all([
    supabase
      .from("tutores")
      .select("id, nombre, apellido, telefono_wa")
      .eq("consultorio_id", consultorioId)
      .eq("id", paciente.responsable_pago_id)
      .maybeSingle(),
    textosDePlantillas(supabase, consultorioId),
  ]);
  if (!tutor) return null;

  const { fecha, hora } = aHoraLocal(turno.inicio);
  return {
    clave,
    referencia: turnoId,
    tutorId: tutor.id,
    tutor: `${tutor.nombre} ${tutor.apellido ?? ""}`.trim(),
    texto: textoMensajeTurno({ plantilla: textos[clave], tutor: tutor.nombre, paciente: paciente.nombre, fecha, hora }),
    telefono: tutor.telefono_wa,
  };
}

/** Pacientes del consultorio con lo que usan los mensajes. */
async function leerPacientes(supabase: Supabase, consultorioId: string) {
  const filas = await leerTodo((a, b) =>
    supabase.from("pacientes").select("id, nombre, responsable_pago_id, plan_cobro").eq("consultorio_id", consultorioId).order("id").range(a, b),
  );
  return filas.map((p) => ({ ...p, plan_cobro: p.plan_cobro as PlanCobro }));
}

/**
 * Cargos con lo que usan el vencimiento y el detalle del monto. Del snapshot se trae solo el estado y
 * nunca `concepto` ni `motivo`, que son texto libre (regla de oro 7).
 */
async function leerCargos(supabase: Supabase, consultorioId: string, tutorIds: string[]) {
  if (tutorIds.length === 0) return [];
  const filas = await leerTodo((a, b) =>
    supabase
      .from("cargos")
      .select(
        "id, tutor_id, paciente_id, fecha, monto_gs, estado:snapshot->>estado, turnos!cargos_consultorio_id_turno_id_fkey(tipos_turno!turnos_consultorio_id_tipo_turno_id_fkey(nombre, cobra_en_el_momento))",
      )
      .eq("consultorio_id", consultorioId)
      .in("tutor_id", tutorIds)
      .order("id")
      .range(a, b),
  );
  return filas.map((c) => ({
    id: c.id,
    tutor_id: c.tutor_id,
    paciente_id: c.paciente_id,
    fecha: c.fecha,
    monto_gs: Number(c.monto_gs),
    cobra_en_el_momento: c.turnos?.tipos_turno?.cobra_en_el_momento ?? false,
    estado: c.estado ?? null,
    tipo: c.turnos?.tipos_turno?.nombre ?? null,
  }));
}

async function leerPagos(supabase: Supabase, consultorioId: string, tutorIds: string[]) {
  if (tutorIds.length === 0) return [];
  const filas = await leerTodo((a, b) =>
    supabase.from("pagos").select("id, tutor_id, fecha, monto_gs").eq("consultorio_id", consultorioId).in("tutor_id", tutorIds).order("id").range(a, b),
  );
  return filas.map((p) => ({ ...p, monto_gs: Number(p.monto_gs) }));
}

/**
 * Todo lo que necesita pendientesDelDia (Mensajes de hoy). Solo datos administrativos:
 * nombres, teléfonos, turnos, cargos y pagos. Nada clínico (regla de oro 7).
 * `cache()`: lo piden el contador del menú y la página; se lee una vez por pedido.
 */
export const obtenerDatosPendientes = cache(async (hoy: string): Promise<DatosPendientes> => {
  const consultorio = await exigirConsultorio();
  const supabase = await crearClienteServidor();
  const { tramos, bloqueos } = await obtenerHorario();
  const rango = rangoDeTurnos(hoy, proximoDiaDeAtencion(hoy, tramos, bloqueos));
  // Lo enviado desde el comienzo del rango (o la última semana, para los recordatorios de pago).
  const desdeEnviados = [rango.desde, sumarDias(hoy, -DIAS_ENTRE_RECORDATORIOS_PAGO)].sort()[0];
  const id = consultorio.id;

  const [{ data: config, error: errorConfig }, plantillas, tutores, pacientes, turnosBase, saldos, enviados] = await Promise.all([
    supabase.from("consultorios").select("datos_pago, dia_limite_pago, horas_aviso_minimas").eq("id", id).single(),
    textosDePlantillas(supabase, id),
    leerTodo((a, b) => supabase.from("tutores").select("id, nombre, apellido, telefono_wa").eq("consultorio_id", id).order("id").range(a, b)),
    leerPacientes(supabase, id),
    leerTodo((a, b) =>
      supabase
        .from("turnos")
        .select("id, clase, estado, paciente_id, inicio")
        .eq("consultorio_id", id)
        .gte("inicio", inicioDelDiaUtc(rango.desde))
        .lt("inicio", inicioDelDiaUtc(sumarDias(rango.hasta, 1)))
        .order("id")
        .range(a, b),
    ),
    leerTodo((a, b) => supabase.from("saldos_tutores").select("tutor_id, saldo_gs").eq("consultorio_id", id).order("tutor_id").range(a, b)),
    leerTodo((a, b) =>
      supabase
        .from("mensajes_enviados")
        .select("clave, referencia, tutor_id, enviado_en")
        .eq("consultorio_id", id)
        .gte("enviado_en", inicioDelDiaUtc(desdeEnviados))
        .order("id")
        .range(a, b),
    ),
  ]);
  if (errorConfig || !config) throw new Error("No se pudo leer el consultorio");

  const turnos = turnosBase.map((t) => {
    const local = aHoraLocal(t.inicio);
    return { id: t.id, clase: t.clase, estado: t.estado, paciente_id: t.paciente_id, fecha: local.fecha, hora: local.hora };
  });
  // Sin esto, cada pantalla traería la historia entera de todas las familias para el contador del menú.
  const tutorIds = tutoresConCuentaNecesaria(hoy, {
    saldos: saldos.flatMap((s) => (s.tutor_id ? [{ tutor_id: s.tutor_id, saldo_gs: Number(s.saldo_gs) }] : [])),
    turnos,
    pacientes,
  });
  const [cargos, pagos] = await Promise.all([leerCargos(supabase, id, tutorIds), leerPagos(supabase, id, tutorIds)]);

  return {
    plantillas,
    datosPago: config.datos_pago,
    diaLimitePago: config.dia_limite_pago,
    horasAvisoMinimas: config.horas_aviso_minimas,
    tramos,
    bloqueos,
    tutores,
    pacientes,
    turnos,
    cargos,
    pagos,
    enviados: enviados.map((e) => ({ clave: e.clave, referencia: e.referencia, tutor_id: e.tutor_id, fecha: aHoraLocal(e.enviado_en).fecha })),
  };
});

/**
 * Mensaje de monto de un tutor para cada período (esta semana, este mes y el mes pasado), con la
 * familia junta. Null si el tutor no existe. Solo datos administrativos (regla de oro 7).
 */
export async function obtenerMontosTutor(tutorId: string, hoy: string) {
  if (!esIdValido(tutorId)) return null;
  const consultorio = await exigirConsultorio();
  const supabase = await crearClienteServidor();
  const id = consultorio.id;
  const opciones = opcionesPeriodo(hoy);
  const desde = opciones.map((o) => o.rango.desde).sort()[0];

  const [{ data: config, error: errorConfig }, { data: tutor, error: errorTutor }, plantillas, pacientes, cargos, pagos, enviados] = await Promise.all([
    supabase.from("consultorios").select("datos_pago, horas_aviso_minimas").eq("id", id).single(),
    supabase.from("tutores").select("id, nombre, apellido, telefono_wa").eq("consultorio_id", id).eq("id", tutorId).maybeSingle(),
    textosDePlantillas(supabase, id),
    leerPacientes(supabase, id),
    leerCargos(supabase, id, [tutorId]),
    leerPagos(supabase, id, [tutorId]),
    leerTodo((a, b) =>
      supabase
        .from("mensajes_enviados")
        .select("referencia")
        .eq("consultorio_id", id)
        .eq("tutor_id", tutorId)
        .eq("clave", "monto_periodo")
        .in(
          "referencia",
          opciones.map((o) => o.referencia),
        )
        .order("id")
        .range(a, b),
    ),
  ]);
  if (errorConfig || !config || errorTutor) throw new Error("No se pudieron leer los datos del mensaje");
  if (!tutor) return null;

  // Los hijos a cargo hoy: para saber el plan y si quedan turnos sin marcar.
  const hijos = pacientes.filter((p) => p.responsable_pago_id === tutorId);
  const sinMarcar = await leerTodo((a, b) =>
    supabase
      .from("turnos")
      .select("id, inicio")
      .eq("consultorio_id", id)
      .eq("clase", "turno")
      .eq("estado", "agendado")
      .in(
        "paciente_id",
        hijos.map((p) => p.id),
      )
      .gte("inicio", inicioDelDiaUtc(desde))
      .lt("inicio", inicioDelDiaUtc(sumarDias(hoy, 1)))
      .order("id")
      .range(a, b),
  );

  const nombrePaciente = new Map(pacientes.map((p) => [p.id, p.nombre]));
  const montos = montosDeTutor({
    hoy,
    tutor: { id: tutor.id, nombre: tutor.nombre, tutor: `${tutor.nombre} ${tutor.apellido ?? ""}`.trim(), telefono: tutor.telefono_wa },
    plantilla: plantillas.monto_periodo,
    datosPago: config.datos_pago,
    horasAvisoMinimas: config.horas_aviso_minimas,
    cargos: cargos.map((c) => ({ ...c, paciente: (c.paciente_id && nombrePaciente.get(c.paciente_id)) || null })),
    pagos,
    fechasSinMarcar: sinMarcar.map((t) => aHoraLocal(t.inicio).fecha),
    referenciasEnviadas: enviados.map((e) => e.referencia),
  });
  return { montos, inicial: periodoInicial(montos, hijos.map((p) => p.plan_cobro)) };
}

/** Mensajes de hoy sin mandar, para el contador del menú. Si algo falla, 0 (no rompe el menú). */
export async function contarPendientes(): Promise<number> {
  try {
    const hoy = hoyEnAsuncion();
    return cantidadSinEnviar(pendientesDelDia(hoy, await obtenerDatosPendientes(hoy)));
  } catch (e) {
    // Lo propio de Next (redirecciones, render dinámico) sigue su camino; lo demás solo esconde el contador.
    unstable_rethrow(e);
    return 0;
  }
}
