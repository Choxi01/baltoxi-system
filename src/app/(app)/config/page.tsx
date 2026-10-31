import type { Metadata } from "next";

import { Pestanas } from "@/components/app/pestanas";
import { agregarBloqueo, borrarBloqueo, guardarHorario } from "@/lib/agenda/acciones";
import { obtenerHorario } from "@/lib/agenda/datos";
import {
  actualizarConsultorio,
  actualizarTarifa,
  actualizarTipoTurno,
  agregarExcepcion,
  cambiarActivaTarifa,
  cambiarActivoTipoTurno,
  crearTarifa,
  crearTipoTurno,
  guardarReglas,
  quitarExcepcion,
} from "@/lib/config/acciones";
import { listarTiposTurno, listarTodasLasTarifas, obtenerConsultorio, obtenerReglas } from "@/lib/config/datos";
import { hoyEnAsuncion } from "@/lib/fechas";
import { guardarPlantilla } from "@/lib/mensajes/acciones";
import { listarPlantillas } from "@/lib/mensajes/datos";
import { Feriados } from "./feriados";
import { Horario } from "./horario";
import { TabConsultorio } from "./tab-consultorio";
import { TabMensajes } from "./tab-mensajes";
import { TabReglas } from "./tab-reglas";
import { TabTarifas } from "./tab-tarifas";
import { TabTiposTurno } from "./tab-tipos-turno";

export const metadata: Metadata = { title: "Configuración · Consultorio" };

export default async function Pagina({ searchParams }: PageProps<"/config">) {
  const { pestana } = await searchParams;
  const [consultorio, tarifas, { duracion, tramos, bloqueos }, tipos, reglas, plantillas] = await Promise.all([
    obtenerConsultorio(),
    listarTodasLasTarifas(),
    obtenerHorario(),
    listarTiposTurno(),
    obtenerReglas(),
    listarPlantillas(),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">Configuración</h1>
      <Pestanas
        etiqueta="Secciones de la configuración"
        inicial={typeof pestana === "string" ? pestana : "consultorio"}
        pestanas={[
          {
            id: "consultorio",
            titulo: "Consultorio",
            contenido: <TabConsultorio accion={actualizarConsultorio} valores={consultorio} />,
          },
          {
            id: "tarifas",
            titulo: "Tarifas",
            contenido: (
              <TabTarifas tarifas={tarifas} crear={crearTarifa} actualizar={actualizarTarifa} cambiarActiva={cambiarActivaTarifa} />
            ),
          },
          {
            id: "horario",
            titulo: "Horario y feriados",
            contenido: (
              <div className="flex flex-col gap-8 pt-4">
                <section className="flex flex-col gap-3">
                  <h2 className="text-lg font-semibold">Horario de atención</h2>
                  <p className="text-sm text-muted-foreground">
                    Podés cargar varios tramos por día (horario partido). La agenda arma los bloques solo dentro de estos tramos.
                  </p>
                  <Horario inicial={{ duracion, tramos }} guardar={guardarHorario} />
                </section>
                <section className="flex flex-col gap-3">
                  <h2 className="text-lg font-semibold">Feriados y vacaciones</h2>
                  <p className="text-sm text-muted-foreground">Esos días la agenda no tiene horarios.</p>
                  <Feriados bloqueos={bloqueos} hoy={hoyEnAsuncion()} agregar={agregarBloqueo} borrar={borrarBloqueo} />
                </section>
              </div>
            ),
          },
          {
            id: "tipos",
            titulo: "Tipos de turno",
            contenido: (
              <TabTiposTurno
                tipos={tipos}
                tarifas={tarifas}
                crear={crearTipoTurno}
                actualizar={actualizarTipoTurno}
                cambiarActivo={cambiarActivoTipoTurno}
              />
            ),
          },
          {
            id: "reglas",
            titulo: "Reglas de cobro",
            contenido: (
              <TabReglas
                generales={reglas.generales}
                excepciones={reglas.excepciones}
                pacientes={reglas.pacientes}
                horasAviso={consultorio.horas_aviso_minimas}
                guardar={guardarReglas}
                agregarExcepcion={agregarExcepcion}
                quitarExcepcion={quitarExcepcion}
              />
            ),
          },
          {
            id: "mensajes",
            titulo: "Mensajes",
            contenido: <TabMensajes plantillas={plantillas} guardar={guardarPlantilla} />,
          },
        ]}
      />
    </div>
  );
}
