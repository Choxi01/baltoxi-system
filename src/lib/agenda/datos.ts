import "server-only";

import { cache } from "react";

import { exigirConsultorio } from "@/lib/auth/servidor";
import { cobroDelCargo, puedeCobrarAhora } from "@/lib/cobro/pago";
import { imputarPagos } from "@/lib/cobro/saldo";
import type { PlanCobro } from "@/lib/cobro/tipos";
import { leerTodo } from "@/lib/supabase/paginar";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { finDeMes, inicioDeMes, sumarDias } from "./calendario";
import { pendientesDeReponer } from "./cancelacion";
import { horaDeBase } from "./horario";
import { PLANTILLA_LIBRES_POR_DEFECTO } from "./libres";
import { aHoraLocal, inicioDelDiaUtc, type ClaseTurno, type EstadoTurno, type TurnoAgenda } from "./turnos";

// Lecturas del horario de atención y de los feriados/vacaciones.
// Todo pasa por RLS y además se filtra por el consultorio.

// `cache()`: lo piden el contador del menú y varias páginas; se lee una vez por pedido.
export const obtenerHorario = cache(async () => {
  const consultorio = await exigirConsultorio();
  const supabase = await crearClienteServidor();
  const [{ data: config, error }, { data: tramos }, { data: bloqueos }] = await Promise.all([
    supabase.from("consultorios").select("duracion_bloque_min").eq("id", consultorio.id).single(),
    supabase.from("horarios_atencion").select("dia_semana, desde, hasta").eq("consultorio_id", consultorio.id),
    supabase.from("bloqueos").select("id, desde, hasta, motivo").eq("consultorio_id", consultorio.id).order("desde"),
  ]);
  if (error || !config) throw new Error("No se pudo leer el horario");
  return {
    duracion: config.duracion_bloque_min,
    tramos: (tramos ?? []).map((t) => ({ dia_semana: t.dia_semana, desde: horaDeBase(t.desde), hasta: horaDeBase(t.hasta) })),
    bloqueos: bloqueos ?? [],
  };
});

/**
 * Turnos de un rango de días (de Asunción), ya pasados a la hora local.
 * Solo datos administrativos: nombre del paciente y tipo de turno (regla de oro 7).
 */
export async function listarTurnos(desde: string, hasta: string): Promise<TurnoAgenda[]> {
  const consultorio = await exigirConsultorio();
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .from("turnos")
    .select(
      "id, clase, estado, inicio, fin, paciente_id, tipo_turno_id, serie_id, nombre_reserva, motivo_ocupado, porcentaje_manual, pacientes!turnos_consultorio_id_paciente_id_fkey(nombre, apellido), tipos_turno!turnos_consultorio_id_tipo_turno_id_fkey(nombre, modalidad, color)",
    )
    .eq("consultorio_id", consultorio.id)
    .gte("inicio", inicioDelDiaUtc(desde))
    .lt("inicio", inicioDelDiaUtc(sumarDias(hasta, 1)))
    .order("inicio");
  if (error) throw new Error("No se pudieron leer los turnos");

  return (data ?? []).map((t) => {
    const inicio = aHoraLocal(t.inicio);
    const paciente = t.pacientes ? `${t.pacientes.nombre} ${t.pacientes.apellido ?? ""}`.trim() : null;
    return {
      id: t.id,
      clase: t.clase as ClaseTurno,
      estado: t.estado as EstadoTurno,
      fecha: inicio.fecha,
      inicio: inicio.hora,
      fin: aHoraLocal(t.fin).hora,
      titulo: (t.clase === "turno" ? paciente : t.clase === "reservado" ? t.nombre_reserva : t.motivo_ocupado) ?? "",
      tipo: t.tipos_turno?.nombre ?? null,
      serieId: t.serie_id,
      tipoId: t.tipo_turno_id,
      pacienteId: t.paciente_id,
      color: t.tipos_turno?.color ?? null,
      modalidad: t.tipos_turno?.modalidad ?? null,
      porcentajeManual: t.porcentaje_manual,
    };
  });
}

/**
 * Como `listarTurnos`, pero a cada turno que lleva "Cobrar ahora" (B4) le agrega `cobro`:
 * tipo que cobra en el momento o plan por sesión, y algo pendiente después de imputar los pagos (FIFO).
 * La usan las pantallas Agenda y Hoy; las acciones de servidor siguen con `listarTurnos`.
 */
export async function listarTurnosConCobro(desde: string, hasta: string): Promise<TurnoAgenda[]> {
  const consultorio = await exigirConsultorio();
  const supabase = await crearClienteServidor();

  // Los turnos y los cargos del rango se piden a la vez: no dependen uno del otro.
  // Cargos por fecha, no por lista de ids: el rango puede tener cientos de turnos.
  const [turnos, cargosRango] = await Promise.all([
    listarTurnos(desde, hasta),
    leerTodo((de, a) =>
      supabase
        .from("cargos")
        .select(
          "id, turno_id, tutor_id, pacientes!cargos_consultorio_id_paciente_id_fkey(plan_cobro), turnos!cargos_consultorio_id_turno_id_fkey(tipos_turno!turnos_consultorio_id_tipo_turno_id_fkey(cobra_en_el_momento))",
        )
        .eq("consultorio_id", consultorio.id)
        .not("turno_id", "is", null)
        .gte("fecha", desde)
        .lte("fecha", hasta)
        .order("id")
        .range(de, a),
    ),
  ]);

  // Primero sin mirar lo pendiente: solo los que podrían llevar el botón.
  const candidatos = new Map(
    cargosRango
      .filter((c) => c.turno_id)
      .map((c) => ({
        cargoId: c.id,
        turnoId: c.turno_id!,
        tutorId: c.tutor_id,
        plan: (c.pacientes?.plan_cobro ?? "mensual") as PlanCobro,
        cobraEnElMomento: c.turnos?.tipos_turno?.cobra_en_el_momento ?? false,
      }))
      .filter((c) => c.cobraEnElMomento || c.plan === "por_sesion")
      .map((c) => [c.turnoId, c]),
  );
  if (candidatos.size === 0) return turnos;

  const tutorIds = [...new Set([...candidatos.values()].map((c) => c.tutorId))];
  const [cargos, pagos, { data: tutores, error }] = await Promise.all([
    leerTodo((de, a) =>
      supabase.from("cargos").select("id, tutor_id, fecha, monto_gs").eq("consultorio_id", consultorio.id).in("tutor_id", tutorIds).order("id").range(de, a),
    ),
    leerTodo((de, a) =>
      supabase.from("pagos").select("id, tutor_id, fecha, monto_gs").eq("consultorio_id", consultorio.id).in("tutor_id", tutorIds).order("id").range(de, a),
    ),
    supabase.from("tutores").select("id, nombre, apellido").eq("consultorio_id", consultorio.id).in("id", tutorIds),
  ]);
  if (error) throw new Error("No se pudieron leer los cobros");

  const imputaciones = new Map(
    tutorIds.map((id) => [
      id,
      imputarPagos({ cargos: cargos.filter((c) => c.tutor_id === id), pagos: pagos.filter((p) => p.tutor_id === id) }),
    ]),
  );
  const nombres = new Map((tutores ?? []).map((t) => [t.id, `${t.nombre} ${t.apellido ?? ""}`.trim()]));

  return turnos.map((t) => {
    const c = candidatos.get(t.id);
    if (!c) return t;
    const cobro = cobroDelCargo(c.cargoId, imputaciones.get(c.tutorId) ?? []);
    if (!cobro || !puedeCobrarAhora({ ...t, cobraEnElMomento: c.cobraEnElMomento, plan: c.plan, pendiente: cobro.pendiente })) return t;
    return { ...t, cobro: { tutorId: c.tutorId, tutorNombre: nombres.get(c.tutorId) ?? "", ...cobro } };
  });
}

/** Lo que necesita la agenda para reservar: pacientes activos, tipos de turno, traslado y horas mínimas de aviso. */
export async function obtenerDatosParaReservar() {
  const consultorio = await exigirConsultorio();
  const supabase = await crearClienteServidor();
  const [{ data: pacientes }, { data: tipos }, { data: config }] = await Promise.all([
    supabase
      .from("pacientes")
      .select("id, nombre, apellido")
      .eq("consultorio_id", consultorio.id)
      .eq("estado", "activo")
      .order("nombre"),
    supabase
      .from("tipos_turno")
      .select("id, nombre, modalidad, color, requiere_paciente")
      .eq("consultorio_id", consultorio.id)
      .eq("activo", true)
      .order("nombre"),
    supabase.from("consultorios").select("traslado_domicilio_min, horas_aviso_minimas").eq("id", consultorio.id).single(),
  ]);
  return {
    pacientes: pacientes ?? [],
    tipos: tipos ?? [],
    trasladoMin: config?.traslado_domicilio_min ?? 30,
    horasAvisoMinimas: config?.horas_aviso_minimas ?? 48,
  };
}

/** "Para reponer este mes": sesiones que canceló la profesional y todavía no tienen reposición. */
export async function listarParaReponer(hoy: string) {
  const consultorio = await exigirConsultorio();
  const supabase = await crearClienteServidor();
  const { data: cancelados, error } = await supabase
    .from("turnos")
    .select("id, estado, reponer, inicio, paciente_id, tipo_turno_id, pacientes!turnos_consultorio_id_paciente_id_fkey(nombre, apellido)")
    .eq("consultorio_id", consultorio.id)
    .eq("estado", "cancelado_profesional")
    .eq("reponer", true)
    .gte("inicio", inicioDelDiaUtc(inicioDeMes(hoy)))
    .lt("inicio", inicioDelDiaUtc(sumarDias(finDeMes(hoy), 1)))
    .order("inicio");
  if (error) throw new Error("No se pudo leer la lista para reponer");
  if (!cancelados?.length) return [];
  const { data: reposiciones, error: errorReposiciones } = await supabase
    .from("turnos")
    .select("repone_a, estado")
    .eq("consultorio_id", consultorio.id)
    .in("repone_a", cancelados.map((c) => c.id));
  if (errorReposiciones) throw new Error("No se pudo leer la lista para reponer");
  return pendientesDeReponer(cancelados, reposiciones ?? []).map((t) => {
    const { fecha, hora } = aHoraLocal(t.inicio);
    return {
      id: t.id,
      fecha,
      inicio: hora,
      pacienteId: t.paciente_id,
      tipoId: t.tipo_turno_id,
      titulo: t.pacientes ? `${t.pacientes.nombre} ${t.pacientes.apellido ?? ""}`.trim() : "",
    };
  });
}

/** Plantilla `horarios_libres` del consultorio (para "Copiar libres"). Si no está, la de por defecto. */
export async function obtenerPlantillaLibres(): Promise<string> {
  const consultorio = await exigirConsultorio();
  const supabase = await crearClienteServidor();
  const { data } = await supabase
    .from("plantillas_mensaje")
    .select("texto")
    .eq("consultorio_id", consultorio.id)
    .eq("clave", "horarios_libres")
    .maybeSingle();
  return data?.texto?.trim() ? data.texto : PLANTILLA_LIBRES_POR_DEFECTO;
}
