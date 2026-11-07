import "server-only";

import { finDeMes, inicioDeMes, sumarDias } from "@/lib/agenda/calendario";
import { listarTurnos } from "@/lib/agenda/datos";
import { inicioDelDiaUtc } from "@/lib/agenda/turnos";
import { exigirConsultorio } from "@/lib/auth/servidor";
import { leerTodo } from "@/lib/supabase/paginar";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { CRITERIO_AUSENCIAS } from "./criterios-reportes";
import { armarReporte, type Reporte, type TurnoReporte } from "./reportes";
import type { EstadoTurno, TipoTurno } from "./tipos";

// Lecturas de Reportes (B8). Solo datos administrativos (regla de oro 7): acá no se leen notas,
// anamnesis, documentos, motivo de consulta ni el motivo de una excepción. El motivo de un bloque
// ocupado se usa para saber si suma horas y no sale de este servidor.

/** Todo lo de la pantalla y del Excel. `mes` = primer día del mes; `semana` = lunes. */
export async function obtenerReporte({
  mes,
  semana,
  hoy,
  ahora,
}: {
  mes: string;
  semana: string;
  hoy: string;
  ahora: Date;
}): Promise<Reporte> {
  const consultorio = await exigirConsultorio();
  const supabase = await crearClienteServidor();

  // Alcanza para los 6 meses de la comparación y para la historia de la tasa.
  const desde = inicioDeMes(mes, -Math.max(5, CRITERIO_AUSENCIAS.mesesHistoria));

  const [cargos, pagos, turnos, { data: tarifas, error: errorTarifas }, { data: horario, error: errorHorario }, turnosSemana] =
    await Promise.all([
      // Toda la historia: el pendiente sale de imputar todos los pagos, del más viejo al más nuevo.
      leerTodo((de, a) =>
        supabase
          .from("cargos")
          .select("id, tutor_id, turno_id, tipo, fecha, monto_gs")
          .eq("consultorio_id", consultorio.id)
          .order("id")
          .range(de, a),
      ),
      leerTodo((de, a) =>
        supabase.from("pagos").select("id, tutor_id, fecha, monto_gs").eq("consultorio_id", consultorio.id).order("id").range(de, a),
      ),
      leerTodo((de, a) =>
        supabase
          .from("turnos")
          .select(
            "id, clase, estado, inicio, fin, motivo_ocupado, pacientes!turnos_consultorio_id_paciente_id_fkey(tarifa_id, monto_override_gs), tipos_turno!turnos_consultorio_id_tipo_turno_id_fkey(tarifa_id, genera_cobro, requiere_paciente, modalidad)",
          )
          .eq("consultorio_id", consultorio.id)
          .gte("inicio", inicioDelDiaUtc(desde))
          .lt("inicio", inicioDelDiaUtc(sumarDias(finDeMes(mes), 1)))
          .order("id")
          .range(de, a),
      ),
      // También las desactivadas: el turno puede ser de antes de desactivarla.
      supabase.from("tarifas").select("id, nombre, monto_gs").eq("consultorio_id", consultorio.id),
      supabase.from("horarios_atencion").select("dia_semana").eq("consultorio_id", consultorio.id),
      listarTurnos(semana, sumarDias(semana, 6)),
    ]);
  if (errorTarifas || errorHorario) throw new Error("No se pudieron leer los datos del reporte");

  return armarReporte({
    mes,
    semana,
    hoy,
    ahora,
    cargos: cargos.map((c) => ({ ...c, tipo: c.tipo as "sesion" | "ajuste" })),
    pagos,
    turnos: turnos.map(
      (t): TurnoReporte => ({
        id: t.id,
        clase: t.clase as TurnoReporte["clase"],
        estado: t.estado as EstadoTurno,
        inicio: t.inicio,
        fin: t.fin,
        motivo_ocupado: t.motivo_ocupado,
        paciente: t.pacientes,
        tipoTurno: t.tipos_turno ? { ...t.tipos_turno, modalidad: t.tipos_turno.modalidad as TipoTurno["modalidad"] } : null,
      }),
    ),
    tarifas: tarifas ?? [],
    diasConHorario: (horario ?? []).map((h) => h.dia_semana),
    turnosSemana,
  });
}
