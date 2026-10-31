import "server-only";

import { exigirConsultorio } from "@/lib/auth/servidor";
import { esIdValido } from "@/lib/pacientes/datos";
import { leerTodo } from "@/lib/supabase/paginar";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { cuentaTutor, quienDebe, type CargoCuenta, type PagoCuenta } from "./cuenta";
import type { PlanCobro } from "./tipos";

// Lecturas de la pantalla Cobros (B4). Solo datos administrativos (regla de oro 7):
// nombre del tutor y del paciente, concepto del cargo ("Sesión 05/11/2026"), montos y fechas.

type Supabase = Awaited<ReturnType<typeof crearClienteServidor>>;

const nombreDe = (p: { nombre: string; apellido: string | null } | null) => (p ? `${p.nombre} ${p.apellido ?? ""}`.trim() : null);

async function diaLimitePago(supabase: Supabase, consultorioId: string): Promise<number> {
  const { data, error } = await supabase.from("consultorios").select("dia_limite_pago").eq("id", consultorioId).single();
  if (error || !data) throw new Error("No se pudo leer el consultorio");
  return data.dia_limite_pago;
}

/** Cargos con lo que hace falta para el vencimiento (plan del paciente y si el tipo cobra en el momento). */
async function leerCargos(supabase: Supabase, consultorioId: string, tutorId?: string) {
  const filas = await leerTodo((de, a) => {
    let q = supabase
      .from("cargos")
      .select(
        "id, tutor_id, fecha, monto_gs, concepto, pacientes!cargos_consultorio_id_paciente_id_fkey(nombre, apellido, plan_cobro), turnos!cargos_consultorio_id_turno_id_fkey(tipos_turno!turnos_consultorio_id_tipo_turno_id_fkey(cobra_en_el_momento))",
      )
      .eq("consultorio_id", consultorioId);
    if (tutorId) q = q.eq("tutor_id", tutorId);
    return q.order("id").range(de, a);
  });
  return filas.map((c) => ({
    tutor_id: c.tutor_id,
    cargo: {
      id: c.id,
      fecha: c.fecha,
      monto_gs: c.monto_gs,
      concepto: c.concepto,
      paciente: nombreDe(c.pacientes),
      plan: (c.pacientes?.plan_cobro ?? "mensual") as PlanCobro,
      cobraEnElMomento: c.turnos?.tipos_turno?.cobra_en_el_momento ?? false,
    } satisfies CargoCuenta,
  }));
}

async function leerPagos(supabase: Supabase, consultorioId: string, tutorId?: string) {
  const filas = await leerTodo((de, a) => {
    let q = supabase.from("pagos").select("id, tutor_id, fecha, monto_gs, medio, referencia, factura_id").eq("consultorio_id", consultorioId);
    if (tutorId) q = q.eq("tutor_id", tutorId);
    return q.order("id").range(de, a);
  });
  return filas.map(({ tutor_id, ...pago }) => ({ tutor_id, pago: pago satisfies PagoCuenta }));
}

/** "Quién debe": saldos de `saldos_tutores` con el atraso de cada tutor (docs/reglas-cobro.md §5). */
export async function listarQuienDebe(hoy: string) {
  const consultorio = await exigirConsultorio();
  const supabase = await crearClienteServidor();
  const [{ data: saldos, error }, cargos, pagos, limite] = await Promise.all([
    supabase.from("saldos_tutores").select("tutor_id, nombre, saldo_gs").eq("consultorio_id", consultorio.id),
    leerCargos(supabase, consultorio.id),
    leerPagos(supabase, consultorio.id),
    diaLimitePago(supabase, consultorio.id),
  ]);
  if (error) throw new Error("No se pudieron leer los saldos");

  const filas = (saldos ?? [])
    .filter((s) => s.tutor_id)
    .map((s) => {
      const cuenta = cuentaTutor({
        cargos: cargos.filter((c) => c.tutor_id === s.tutor_id).map((c) => c.cargo),
        pagos: pagos.filter((p) => p.tutor_id === s.tutor_id).map((p) => p.pago),
        hoy,
        diaLimitePago: limite,
      });
      return {
        tutorId: s.tutor_id!,
        nombre: s.nombre ?? "",
        saldo: s.saldo_gs ?? 0,
        enAtraso: cuenta.enAtraso,
        diasAtraso: cuenta.diasAtraso,
        vencidoGs: cuenta.vencidoGs,
      };
    });
  return quienDebe(filas);
}

/** Todos los tutores activos, para elegir quién paga en "Registrar pago". */
export async function listarTutoresParaPago() {
  const consultorio = await exigirConsultorio();
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .from("tutores")
    .select("id, nombre, apellido")
    .eq("consultorio_id", consultorio.id)
    .eq("activo", true)
    .order("nombre");
  if (error) throw new Error("No se pudieron leer los tutores");
  return (data ?? []).map((t) => ({ id: t.id, nombre: nombreDe(t)! }));
}

/** Cuenta de un tutor: cargos, pagos, imputación y saldo acumulado. null si no existe. */
export async function obtenerCuentaTutor(tutorId: string, hoy: string) {
  if (!esIdValido(tutorId)) return null;
  const consultorio = await exigirConsultorio();
  const supabase = await crearClienteServidor();
  const [{ data: tutor, error }, cargos, pagos, limite] = await Promise.all([
    supabase.from("tutores").select("id, nombre, apellido").eq("consultorio_id", consultorio.id).eq("id", tutorId).maybeSingle(),
    leerCargos(supabase, consultorio.id, tutorId),
    leerPagos(supabase, consultorio.id, tutorId),
    diaLimitePago(supabase, consultorio.id),
  ]);
  if (error) throw new Error("No se pudo leer la cuenta");
  if (!tutor) return null;
  return {
    tutor: { id: tutor.id, nombre: nombreDe(tutor)! },
    cuenta: cuentaTutor({ cargos: cargos.map((c) => c.cargo), pagos: pagos.map((p) => p.pago), hoy, diaLimitePago: limite }),
  };
}
