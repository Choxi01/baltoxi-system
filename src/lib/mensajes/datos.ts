import "server-only";

// Lecturas de mensajes. Pasan por RLS y además se filtran por el consultorio.
// No es "use server": son funciones del servidor que no puede llamar el navegador.

import { unstable_rethrow } from "next/navigation";

import { proximoDiaDeAtencion } from "@/lib/agenda/atencion";
import { sumarDias } from "@/lib/agenda/calendario";
import { obtenerHorario } from "@/lib/agenda/datos";
import { aHoraLocal, inicioDelDiaUtc } from "@/lib/agenda/turnos";
import { exigirConsultorio } from "@/lib/auth/servidor";
import { hoyEnAsuncion } from "@/lib/fechas";
import type { PlanCobro } from "@/lib/cobro/tipos";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { DIAS_ENTRE_RECORDATORIOS_PAGO, cantidadSinEnviar, pendientesDelDia, rangoDeTurnos, type DatosPendientes } from "./pendientes";
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


/** De a cuántas filas se lee (PostgREST corta en 1000). */
const PAGINA = 1000;

/** Lee todas las filas de una consulta, de a páginas (cargos y pagos crecen con los años). */
async function todas<T>(pedir: (desde: number, hasta: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const filas: T[] = [];
  for (let desde = 0; ; desde += PAGINA) {
    const { data, error } = await pedir(desde, desde + PAGINA - 1);
    if (error) throw new Error("No se pudieron leer los datos de los mensajes");
    filas.push(...(data ?? []));
    if (!data || data.length < PAGINA) return filas;
  }
}

/**
 * Todo lo que necesita pendientesDelDia (Mensajes de hoy). Solo datos administrativos:
 * nombres, teléfonos, turnos, cargos y pagos. Nada clínico (regla de oro 7).
 */
export async function obtenerDatosPendientes(hoy: string): Promise<DatosPendientes> {
  const consultorio = await exigirConsultorio();
  const supabase = await crearClienteServidor();
  const { tramos, bloqueos } = await obtenerHorario();
  const rango = rangoDeTurnos(hoy, proximoDiaDeAtencion(hoy, tramos, bloqueos));
  // Lo enviado desde el comienzo del rango (o la última semana, para los recordatorios de pago).
  const desdeEnviados = [rango.desde, sumarDias(hoy, -DIAS_ENTRE_RECORDATORIOS_PAGO)].sort()[0];
  const id = consultorio.id;

  const [{ data: config, error: errorConfig }, plantillas, tutores, pacientes, turnos, cargos, pagos, enviados] = await Promise.all([
    supabase.from("consultorios").select("datos_pago, dia_limite_pago").eq("id", id).single(),
    textosDePlantillas(supabase, id),
    todas((a, b) => supabase.from("tutores").select("id, nombre, apellido, telefono_wa").eq("consultorio_id", id).order("id").range(a, b)),
    todas((a, b) =>
      supabase.from("pacientes").select("id, nombre, responsable_pago_id, plan_cobro").eq("consultorio_id", id).order("id").range(a, b),
    ),
    todas((a, b) =>
      supabase
        .from("turnos")
        .select("id, clase, estado, paciente_id, inicio")
        .eq("consultorio_id", id)
        .gte("inicio", inicioDelDiaUtc(rango.desde))
        .lt("inicio", inicioDelDiaUtc(sumarDias(rango.hasta, 1)))
        .order("id")
        .range(a, b),
    ),
    todas((a, b) =>
      supabase
        .from("cargos")
        .select(
          "id, tutor_id, paciente_id, fecha, monto_gs, turnos!cargos_consultorio_id_turno_id_fkey(tipos_turno!turnos_consultorio_id_tipo_turno_id_fkey(cobra_en_el_momento))",
        )
        .eq("consultorio_id", id)
        .order("id")
        .range(a, b),
    ),
    todas((a, b) => supabase.from("pagos").select("id, tutor_id, fecha, monto_gs").eq("consultorio_id", id).order("id").range(a, b)),
    todas((a, b) =>
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

  return {
    plantillas,
    datosPago: config.datos_pago,
    diaLimitePago: config.dia_limite_pago,
    tramos,
    bloqueos,
    tutores,
    pacientes: pacientes.map((p) => ({ ...p, plan_cobro: p.plan_cobro as PlanCobro })),
    turnos: turnos.map((t) => {
      const local = aHoraLocal(t.inicio);
      return { id: t.id, clase: t.clase, estado: t.estado, paciente_id: t.paciente_id, fecha: local.fecha, hora: local.hora };
    }),
    cargos: cargos.map((c) => ({
      id: c.id,
      tutor_id: c.tutor_id,
      paciente_id: c.paciente_id,
      fecha: c.fecha,
      monto_gs: Number(c.monto_gs),
      cobra_en_el_momento: c.turnos?.tipos_turno?.cobra_en_el_momento ?? false,
    })),
    pagos: pagos.map((p) => ({ ...p, monto_gs: Number(p.monto_gs) })),
    enviados: enviados.map((e) => ({ clave: e.clave, referencia: e.referencia, tutor_id: e.tutor_id, fecha: aHoraLocal(e.enviado_en).fecha })),
  };
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
