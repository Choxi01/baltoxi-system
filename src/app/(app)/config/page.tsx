import type { Metadata } from "next";

import { Pestanas } from "@/components/app/pestanas";
import { actualizarConsultorio, actualizarTarifa, cambiarActivaTarifa, crearTarifa } from "@/lib/config/acciones";
import { listarTodasLasTarifas, obtenerConsultorio } from "@/lib/config/datos";
import { TabConsultorio } from "./tab-consultorio";
import { TabTarifas } from "./tab-tarifas";

export const metadata: Metadata = { title: "Configuración · Consultorio" };

export default async function Pagina({ searchParams }: PageProps<"/config">) {
  const { pestana } = await searchParams;
  const [consultorio, tarifas] = await Promise.all([obtenerConsultorio(), listarTodasLasTarifas()]);

  const proximamente = (tarea: string) => <p className="pt-4 text-muted-foreground">Próximamente (tarea {tarea}).</p>;

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
          { id: "tipos", titulo: "Tipos de turno", contenido: proximamente("B1b") },
          { id: "reglas", titulo: "Reglas de cobro", contenido: proximamente("B1b") },
        ]}
      />
    </div>
  );
}
