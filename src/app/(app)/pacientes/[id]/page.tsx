import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Pin } from "lucide-react";

import { Pestanas } from "@/components/app/pestanas";
import { formatoGs } from "@/lib/cobro/formato";
import { hoyEnAsuncion } from "@/lib/fechas";
import { actualizarPaciente } from "@/lib/pacientes/acciones";
import { actualizarNota, borrarNota, crearNota, fijarNota } from "@/lib/pacientes/acciones-notas";
import { NOMBRE_ESTADO, type EstadoPaciente } from "@/lib/pacientes/busqueda";
import { listarNotas, listarTarifas, listarTutoresParaVincular, obtenerPaciente, obtenerTurnoParaNota } from "@/lib/pacientes/datos";
import { textoEdad } from "@/lib/pacientes/edad";
import { textoFecha } from "@/lib/pacientes/fecha";
import { ordenarNotas } from "@/lib/pacientes/notas";
import { NOMBRE_PLAN, PLANES_COBRO } from "@/lib/pacientes/validacion";
import {
  actualizarTutor,
  agregarTutorNuevo,
  marcarResponsable,
  quitarTutor,
  vincularTutorExistente,
} from "@/lib/tutores/acciones";
import { FichaDatos, type FilaResumen } from "./ficha-datos";
import { DatosNota, TabNotas } from "./tab-notas";
import { TabTutores } from "./tab-tutores";

export const metadata: Metadata = { title: "Paciente · Consultorio" };

export default async function PaginaPaciente({ params, searchParams }: PageProps<"/pacientes/[id]">) {
  const { id } = await params;
  const { pestana, turno } = await searchParams;

  const [ficha, disponibles, notas, sesion] = await Promise.all([
    obtenerPaciente(id),
    listarTutoresParaVincular(id),
    listarNotas(id),
    // "Agregar nota de esta sesión" (agenda y Hoy): ?pestana=notas&turno=<id>
    typeof turno === "string" ? obtenerTurnoParaNota(turno, id) : null,
  ]);
  if (!ficha) notFound();
  const tarifas = await listarTarifas(ficha.paciente.tarifa_id);
  const { paciente, tutores } = ficha;
  const hoy = hoyEnAsuncion();
  const edad = textoEdad(paciente.fecha_nacimiento, hoy);
  const nombreDe = (t: { nombre: string; apellido: string | null }) => `${t.nombre} ${t.apellido ?? ""}`.trim();

  const tarifa = tarifas.find((t) => t.id === paciente.tarifa_id);
  const responsable = tutores.find((t) => t.id === paciente.responsable_pago_id);
  const plan = paciente.plan_cobro as (typeof PLANES_COBRO)[number];
  const resumen: FilaResumen[] = [
    {
      etiqueta: "Fecha de nacimiento",
      valor: paciente.fecha_nacimiento ? `${textoFecha(paciente.fecha_nacimiento)} (${edad})` : null,
    },
    { etiqueta: "Colegio", valor: paciente.colegio },
    { etiqueta: "Derivado por", valor: paciente.derivado_por },
    { etiqueta: "Motivo de consulta", valor: paciente.motivo_consulta, clinico: true },
    { etiqueta: "Estado", valor: NOMBRE_ESTADO[paciente.estado as EstadoPaciente] ?? paciente.estado },
    { etiqueta: "Tarifa", valor: tarifa ? `${tarifa.nombre} · ${formatoGs(tarifa.monto_gs)}` : null },
    {
      etiqueta: "Precio especial",
      valor: paciente.monto_override_gs != null ? formatoGs(paciente.monto_override_gs) : null,
    },
    { etiqueta: "Forma de pago", valor: NOMBRE_PLAN[plan] ?? paciente.plan_cobro },
    { etiqueta: "Responsable de pago", valor: responsable ? nombreDe(responsable) : null },
  ];

  const { fijada, resto } = ordenarNotas(notas);

  const proximamente = (tarea: string) => <p className="text-muted-foreground">Próximamente (tarea {tarea}).</p>;

  return (
    <div className="flex flex-col gap-4">
      <Link href="/pacientes" className="flex h-10 items-center gap-1 text-sm text-muted-foreground">
        <ChevronLeft className="size-4" /> Pacientes
      </Link>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {paciente.nombre} {paciente.apellido}
        </h1>
        <p className="text-sm text-muted-foreground">
          {[edad, NOMBRE_ESTADO[paciente.estado as EstadoPaciente]].filter(Boolean).join(" · ")}
        </p>
      </div>

      {fijada && (
        // Nota fijada: siempre visible arriba de la ficha, en todas las pestañas.
        <section aria-label="Nota fijada" className="flex flex-col gap-1 rounded-lg border border-primary/50 bg-primary/5 p-3">
          <span className="flex items-center gap-1 text-xs font-medium text-primary">
            <Pin className="size-3.5" /> Nota fijada · <DatosNota nota={fijada} />
          </span>
          <p className="line-clamp-4 whitespace-pre-wrap break-words text-sm">{fijada.texto}</p>
        </section>
      )}

      <Pestanas
        etiqueta="Secciones del expediente"
        inicial={sesion ? "notas" : typeof pestana === "string" ? pestana : "datos"}
        pestanas={[
          {
            id: "datos",
            titulo: "Datos",
            contenido: (
              <FichaDatos
                resumen={resumen}
                accion={actualizarPaciente.bind(null, paciente.id)}
                valores={paciente}
                tarifas={tarifas}
                tutores={tutores}
                hoy={hoy}
              />
            ),
          },
          {
            id: "tutores",
            titulo: "Tutores",
            contenido: (
              <TabTutores
                tutores={tutores}
                responsableId={paciente.responsable_pago_id}
                disponibles={disponibles}
                agregarNuevo={agregarTutorNuevo.bind(null, paciente.id)}
                vincularExistente={vincularTutorExistente.bind(null, paciente.id)}
                actualizar={actualizarTutor.bind(null, paciente.id)}
                quitar={quitarTutor.bind(null, paciente.id)}
                marcarResponsable={marcarResponsable.bind(null, paciente.id)}
              />
            ),
          },
          { id: "anamnesis", titulo: "Anamnesis", contenido: proximamente("A6") },
          {
            id: "notas",
            titulo: "Notas",
            contenido: (
              <TabNotas
                fijada={fijada}
                resto={resto}
                hoy={hoy}
                sesion={sesion}
                crear={crearNota.bind(null, paciente.id, null)}
                crearDeSesion={sesion ? crearNota.bind(null, paciente.id, sesion.id) : null}
                actualizar={actualizarNota.bind(null, paciente.id)}
                fijar={fijarNota.bind(null, paciente.id)}
                borrar={borrarNota.bind(null, paciente.id)}
              />
            ),
          },
          { id: "documentos", titulo: "Documentos", contenido: proximamente("A7") },
          { id: "cuenta", titulo: "Turnos y cuenta", contenido: proximamente("B4") },
        ]}
      />
    </div>
  );
}
