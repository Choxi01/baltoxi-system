import "server-only";

// Crea, actualiza o borra el cargo de un turno según su estado actual (docs/reglas-cobro.md
// sección 4). La llaman las acciones de servidor de la agenda DESPUÉS de cambiar el estado.
// No es "use server" a propósito: así no queda como acción que el navegador pueda llamar sola.
// Usa el cliente con la sesión del usuario: RLS filtra por consultorio.

import type { MontoAvisoTardio } from "@/lib/agenda/cancelacion";
import type { crearClienteServidor } from "@/lib/supabase/servidor";
import { accionCargo, datosCargo, MES_CERRADO, mensajeErrorCobro } from "./aplicar";
import { calcularCargoTurno, montoBase, type CargoCalculado } from "./cargo";
import type { EstadoConRegla, EstadoTurno, ReglaCobro, Turno } from "./tipos";

type Supabase = Awaited<ReturnType<typeof crearClienteServidor>>;
export type ResultadoCargo = { ok: true } | { ok: false; error: string };

const NO_SE_PUDO = "No se pudo guardar el cobro. Probá de nuevo.";

const COLUMNAS_TURNO = "clase, estado, inicio, porcentaje_manual, motivo_excepcion, paciente_id, tipo_turno_id";

type TurnoParaCargo = {
  clase: string;
  estado: string;
  inicio: string;
  porcentaje_manual: number | null;
  motivo_excepcion: string | null;
  paciente_id: string | null;
  tipo_turno_id: string | null;
};

type Calculo = { ok: true; calculado: CargoCalculado | null; tipoNombre: string | null } | { ok: false; error: string };

/** Lee lo que hace falta y calcula el cargo del turno, sin escribir nada. */
async function calcularCargoDe(supabase: Supabase, consultorioId: string, turno: TurnoParaCargo): Promise<Calculo> {
  let calculado: CargoCalculado | null = null;
  let tipoNombre: string | null = null;
  if (turno.clase === "turno" && turno.estado !== "agendado" && turno.paciente_id && turno.tipo_turno_id) {
    const [{ data: tipo }, { data: paciente }, { data: tarifas }, { data: reglas, error: errorReglas }] = await Promise.all([
      supabase
        .from("tipos_turno")
        .select("nombre, tarifa_id, genera_cobro")
        .eq("consultorio_id", consultorioId)
        .eq("id", turno.tipo_turno_id)
        .maybeSingle(),
      supabase
        .from("pacientes")
        .select("id, tarifa_id, monto_override_gs, responsable_pago_id")
        .eq("consultorio_id", consultorioId)
        .eq("id", turno.paciente_id)
        .maybeSingle(),
      // También las desactivadas: el turno puede ser de antes de desactivarla.
      supabase.from("tarifas").select("id, nombre, monto_gs").eq("consultorio_id", consultorioId),
      supabase
        .from("reglas_cobro")
        .select("estado, porcentaje, paciente_id")
        .eq("consultorio_id", consultorioId)
        .eq("estado", turno.estado),
    ]);
    if (!tipo || !paciente || errorReglas) return { ok: false, error: NO_SE_PUDO };
    tipoNombre = tipo.nombre;
    if (tipo.genera_cobro) {
      try {
        const datosTurno: Turno = {
          clase: "turno",
          estado: turno.estado as EstadoTurno,
          inicio: turno.inicio,
          porcentaje_manual: turno.porcentaje_manual,
          motivo_excepcion: turno.motivo_excepcion,
        };
        calculado = calcularCargoTurno({
          turno: datosTurno,
          tipoTurno: tipo,
          paciente,
          montoBase: montoBase({ tipoTurno: tipo, paciente, tarifas: tarifas ?? [] }),
          reglas: (reglas ?? []).map((r) => ({ ...r, estado: r.estado as EstadoConRegla })) satisfies ReglaCobro[],
        });
      } catch (e) {
        return { ok: false, error: mensajeErrorCobro(e) };
      }
    }
  }
  return { ok: true, calculado, tipoNombre };
}

/**
 * Cuánto se cobraría si este turno queda como aviso tardío, sin excepción (B9). No escribe nada:
 * es el número del botón "Se cobra", con la misma cuenta que después hace el cargo.
 */
export async function montoAvisoTardio(supabase: Supabase, consultorioId: string, turnoId: string): Promise<MontoAvisoTardio> {
  const { data: turno, error } = await supabase
    .from("turnos")
    .select(COLUMNAS_TURNO)
    .eq("consultorio_id", consultorioId)
    .eq("id", turnoId)
    .maybeSingle();
  if (error || !turno) return "desconocido";
  const calculo = await calcularCargoDe(supabase, consultorioId, {
    ...turno,
    estado: "aviso_tardio",
    porcentaje_manual: null,
    motivo_excepcion: null,
  });
  return calculo.ok ? (calculo.calculado?.monto ?? null) : "desconocido";
}

export async function aplicarEstadoTurno(supabase: Supabase, consultorioId: string, turnoId: string): Promise<ResultadoCargo> {
  const [{ data: turno, error: errorTurno }, { data: existente, error: errorCargo }] = await Promise.all([
    supabase
      .from("turnos")
      .select(COLUMNAS_TURNO)
      .eq("consultorio_id", consultorioId)
      .eq("id", turnoId)
      .maybeSingle(),
    supabase.from("cargos").select("id").eq("consultorio_id", consultorioId).eq("turno_id", turnoId).maybeSingle(),
  ]);
  if (errorTurno || errorCargo || !turno) return { ok: false, error: NO_SE_PUDO };

  // Calcular primero (sin escribir nada): si falta un dato, se avisa y no se toca el cargo.
  const calculo = await calcularCargoDe(supabase, consultorioId, turno);
  if (!calculo.ok) return calculo;
  const { calculado, tipoNombre } = calculo;

  const accion = accionCargo(existente, calculado);
  if (accion === "nada") return { ok: true };

  // El trigger cargos_periodo_cerrado rechaza tocar un mes cerrado: las acciones ya lo revisan
  // antes, esto es por si se cerró justo en el medio.
  let error: { message: string } | null = null;
  if (accion === "borrar" && existente) {
    ({ error } = await supabase.from("cargos").delete().eq("consultorio_id", consultorioId).eq("id", existente.id));
  } else if (calculado) {
    const datos = datosCargo(calculado, tipoNombre);
    if (accion === "actualizar" && existente) {
      ({ error } = await supabase.from("cargos").update(datos).eq("consultorio_id", consultorioId).eq("id", existente.id));
    } else {
      ({ error } = await supabase
        .from("cargos")
        .insert({ ...datos, consultorio_id: consultorioId, turno_id: turnoId, paciente_id: turno.paciente_id }));
    }
  }
  if (error) return { ok: false, error: error.message.includes("está cerrado") ? MES_CERRADO : NO_SE_PUDO };
  return { ok: true };
}
