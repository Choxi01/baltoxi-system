import type { Metadata } from "next";

import { Pestanas } from "@/components/app/pestanas";
import { agregarBloqueo, borrarBloqueo, guardarHorario } from "@/lib/agenda/acciones";
import { obtenerHorario } from "@/lib/agenda/datos";
import { hoyEnAsuncion } from "@/lib/fechas";
import { Feriados } from "./feriados";
import { Horario } from "./horario";

export const metadata: Metadata = { title: "Configuración · Consultorio" };

// Configuración con pestañas. La B1 suma Consultorio, Tarifas, Tipos de turno y Reglas.
export default async function Pagina({ searchParams }: PageProps<"/config">) {
  const { pestana } = await searchParams;
  const { duracion, tramos, bloqueos } = await obtenerHorario();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">Configuración</h1>
      <Pestanas
        etiqueta="Secciones de la configuración"
        inicial={typeof pestana === "string" ? pestana : "horario"}
        pestanas={[
          {
            id: "horario",
            titulo: "Horario y feriados",
            contenido: (
              <div className="flex flex-col gap-8 pt-2">
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
        ]}
      />
    </div>
  );
}
