import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { partirNombre } from "@/lib/agenda/reservas";
import { exigirConsultorio } from "@/lib/auth/servidor";
import { hoyEnAsuncion } from "@/lib/fechas";
import { crearPaciente } from "@/lib/pacientes/acciones";
import { esIdValido, listarTarifas } from "@/lib/pacientes/datos";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { FormularioPaciente, type ValoresPaciente } from "../formulario-paciente";

export const metadata: Metadata = { title: "Nuevo paciente · Consultorio" };

/** "Crear ficha" desde la agenda: el nombre de la reserva (si existe y sigue siendo una reserva). */
async function buscarReserva(id: unknown) {
  if (typeof id !== "string" || !esIdValido(id)) return null;
  const consultorio = await exigirConsultorio();
  const supabase = await crearClienteServidor();
  const { data } = await supabase
    .from("turnos")
    .select("id, nombre_reserva")
    .eq("consultorio_id", consultorio.id)
    .eq("id", id)
    .eq("clase", "reservado")
    .maybeSingle();
  return data?.nombre_reserva ? { id: data.id, nombre: data.nombre_reserva } : null;
}

export default async function PaginaNuevoPaciente({ searchParams }: PageProps<"/pacientes/nuevo">) {
  const { reserva: reservaId } = await searchParams;
  const [tarifas, reserva] = await Promise.all([listarTarifas(), buscarReserva(reservaId)]);

  let valores: ValoresPaciente | undefined;
  if (reserva) {
    const { nombre, apellido } = partirNombre(reserva.nombre);
    valores = {
      nombre,
      apellido: apellido || null,
      fecha_nacimiento: null,
      colegio: null,
      derivado_por: null,
      motivo_consulta: null,
      estado: "activo",
      tarifa_id: null,
      monto_override_gs: null,
      plan_cobro: "mensual",
      responsable_pago_id: null,
    };
  }

  return (
    <div className="flex flex-col gap-4">
      <Link href={reserva ? "/agenda" : "/pacientes"} className="flex h-10 items-center gap-1 text-sm text-muted-foreground">
        <ChevronLeft className="size-4" /> {reserva ? "Agenda" : "Pacientes"}
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight">Nuevo paciente</h1>
      <p className="text-sm text-muted-foreground">
        {reserva
          ? `Al guardarlo, el turno "Reservado: ${reserva.nombre}" pasa a ser de este paciente. Después vas a poder agregar sus tutores.`
          : "Después de guardarlo vas a poder agregar sus tutores."}
      </p>
      <FormularioPaciente
        accion={crearPaciente}
        tarifas={tarifas}
        hoy={hoyEnAsuncion()}
        textoBoton="Crear paciente"
        valores={valores}
        reservaId={reserva?.id}
      />
    </div>
  );
}
