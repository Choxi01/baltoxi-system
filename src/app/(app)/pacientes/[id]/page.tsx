import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Pin } from "lucide-react";

import { Pestanas } from "@/components/app/pestanas";
import { crearAnamnesis, guardarRespuestas } from "@/lib/anamnesis/acciones-anamnesis";
import { listarAnamnesis } from "@/lib/anamnesis/datos-anamnesis";
import { listarPlantillasAnamnesis } from "@/lib/anamnesis/datos-plantillas";
import { obtenerCuentaTutor } from "@/lib/cobro/datos";
import { formatoGs } from "@/lib/cobro/formato";
import { borrarDocumento, descartarSubida, linkDocumento, prepararSubida, registrarDocumento } from "@/lib/documentos/acciones";
import { listarDocumentos } from "@/lib/documentos/datos";
import { aHoraLocal } from "@/lib/agenda/turnos";
import { ahoraEnAsuncion } from "@/lib/fechas";
import { estadoReglamentoDeTutores } from "@/lib/ficha/datos-expediente";
import { actualizarPaciente, marcarCambiosVistos } from "@/lib/pacientes/acciones";
import { actualizarNota, borrarNota, crearNota, fijarNota } from "@/lib/pacientes/acciones-notas";
import { NOMBRE_ESTADO, type EstadoPaciente } from "@/lib/pacientes/busqueda";
import {
  listarNotas,
  listarTarifas,
  listarTurnosPaciente,
  listarTutoresParaVincular,
  obtenerPaciente,
  obtenerTurnoParaNota,
} from "@/lib/pacientes/datos";
import { textoEdad } from "@/lib/pacientes/edad";
import { textoFecha } from "@/lib/pacientes/fecha";
import { ordenarNotas } from "@/lib/pacientes/notas";
import { separarTurnos } from "@/lib/pacientes/turnos";
import { NOMBRE_PLAN, PLANES_COBRO } from "@/lib/pacientes/validacion";
import {
  actualizarTutor,
  agregarTutorNuevo,
  marcarResponsable,
  quitarTutor,
  vincularTutorExistente,
} from "@/lib/tutores/acciones";
import { AvisoFamilia } from "./aviso-familia";
import { TabAnamnesis } from "./tab-anamnesis";
import { FichaDatos, type FilaResumen } from "./ficha-datos";
import { TabDocumentos } from "./tab-documentos";
import { DatosNota, TabNotas } from "./tab-notas";
import { TabTurnosCuenta } from "./tab-turnos-cuenta";
import { TabTutores } from "./tab-tutores";

export const metadata: Metadata = { title: "Paciente · Consultorio" };

export default async function PaginaPaciente({ params, searchParams }: PageProps<"/pacientes/[id]">) {
  const { id } = await params;
  const { pestana, turno } = await searchParams;

  const ahora = ahoraEnAsuncion();
  const hoy = ahora.fecha;
  const [ficha, disponibles, notas, documentos, turnos, sesion, anamnesis, plantillas] = await Promise.all([
    obtenerPaciente(id),
    listarTutoresParaVincular(id),
    listarNotas(id),
    listarDocumentos(id),
    listarTurnosPaciente(id),
    // "Agregar nota de esta sesión" (agenda y Hoy): ?pestana=notas&turno=<id>
    typeof turno === "string" ? obtenerTurnoParaNota(turno, id) : null,
    listarAnamnesis(id),
    listarPlantillasAnamnesis(),
  ]);
  if (!ficha) notFound();
  const { paciente, tutores } = ficha;
  const [tarifas, cuentaResponsable, reglamento] = await Promise.all([
    listarTarifas(paciente.tarifa_id),
    paciente.responsable_pago_id ? obtenerCuentaTutor(paciente.responsable_pago_id, hoy) : null,
    estadoReglamentoDeTutores(tutores.map((t) => t.id)),
  ]);
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

  // Cambios que hizo la familia desde la ficha online y la profesional todavía no vio.
  const cambiosFamilia = [
    ...(paciente.cambios_familia_en ? [{ quien: `datos de ${paciente.nombre}`, en: paciente.cambios_familia_en }] : []),
    ...tutores.flatMap((t) => (t.cambios_familia_en ? [{ quien: nombreDe(t), en: t.cambios_familia_en }] : [])),
  ];
  const ultimoCambio = cambiosFamilia.map((c) => c.en).sort().at(-1);

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

      {ultimoCambio && (
        <AvisoFamilia
          cuando={textoFecha(aHoraLocal(ultimoCambio).fecha) ?? ""}
          quien={cambiosFamilia.map((c) => c.quien).join(", ")}
          alVer={marcarCambiosVistos.bind(null, paciente.id)}
        />
      )}

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
                reglamento={reglamento}
                disponibles={disponibles}
                agregarNuevo={agregarTutorNuevo.bind(null, paciente.id)}
                vincularExistente={vincularTutorExistente.bind(null, paciente.id)}
                actualizar={actualizarTutor.bind(null, paciente.id)}
                quitar={quitarTutor.bind(null, paciente.id)}
                marcarResponsable={marcarResponsable.bind(null, paciente.id)}
              />
            ),
          },
          {
            id: "anamnesis",
            titulo: "Anamnesis",
            contenido: (
              <TabAnamnesis
                pacienteId={paciente.id}
                anamnesis={anamnesis}
                plantillas={plantillas.filter((p) => p.activa && p.estructura).map((p) => ({ id: p.id, nombre: p.nombre }))}
                crear={crearAnamnesis.bind(null, paciente.id)}
                guardar={guardarRespuestas.bind(null, paciente.id)}
              />
            ),
          },
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
          {
            id: "documentos",
            titulo: "Documentos",
            contenido: (
              <TabDocumentos
                documentos={documentos}
                hoy={hoy}
                prepararSubida={prepararSubida.bind(null, paciente.id)}
                registrar={registrarDocumento.bind(null, paciente.id)}
                descartarSubida={descartarSubida.bind(null, paciente.id)}
                pedirLink={linkDocumento.bind(null, paciente.id)}
                borrar={borrarDocumento.bind(null, paciente.id)}
              />
            ),
          },
          {
            id: "cuenta",
            titulo: "Turnos y cuenta",
            contenido: <TabTurnosCuenta {...separarTurnos(turnos, ahora)} responsable={cuentaResponsable} />,
          },
        ]}
      />
    </div>
  );
}
