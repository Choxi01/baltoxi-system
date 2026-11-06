import type { Metadata } from "next";
import { connection } from "next/server";

import { inicioDeMes } from "@/lib/agenda/calendario";
import { obtenerReporte } from "@/lib/cobro/datos-reportes";
import { mesValido, semanaValida } from "@/lib/cobro/reportes";
import { hoyEnAsuncion } from "@/lib/fechas";
import { VistaReportes } from "./vista-reportes";

export const metadata: Metadata = { title: "Reportes · Consultorio" };

// Reportes (B8): docs/reglas-cobro.md sección 8 y pedido 6 de docs/pedidos-daniela-2026-11.md.
export default async function Pagina({ searchParams }: PageProps<"/reportes">) {
  // La fecha de hoy es de cada pedido: no se arma la página de antemano.
  await connection();
  const ahora = new Date();
  const hoy = hoyEnAsuncion(ahora);
  const { mes, semana, pestana } = await searchParams;

  const reporte = await obtenerReporte({
    mes: mesValido(mes, hoy) ?? inicioDeMes(hoy),
    semana: semanaValida(semana, hoy),
    hoy,
    ahora,
  });

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">Reportes</h1>
      <VistaReportes reporte={reporte} pestana={typeof pestana === "string" ? pestana : "semana"} />
    </div>
  );
}
