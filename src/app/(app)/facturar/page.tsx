import type { Metadata } from "next";
import { connection } from "next/server";

import { inicioDeMes } from "@/lib/agenda/calendario";
import { deshacerFactura, marcarFacturado } from "@/lib/cobro/acciones-facturas";
import { listarParaFacturar } from "@/lib/cobro/datos-facturar";
import { mesSinTerminar, mesValido } from "@/lib/cobro/facturar";
import { hoyEnAsuncion } from "@/lib/fechas";
import { ListaFacturar } from "./lista-facturar";

export const metadata: Metadata = { title: "Para facturar · Consultorio" };

// Para facturar (B7): pagos del mes sin factura, una fila por familia (docs/reglas-cobro.md §7).
export default async function Pagina({ searchParams }: PageProps<"/facturar">) {
  const parametros = await searchParams;
  // La fecha de hoy es de cada pedido: no se arma la página de antemano.
  await connection();
  const hoy = hoyEnAsuncion();
  const mesActual = inicioDeMes(hoy);
  const mes = mesValido(parametros.mes, hoy) ?? mesActual;
  const { filas, facturas } = await listarParaFacturar(mes);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">Para facturar</h1>
      <ListaFacturar
        mes={mes}
        esMesActual={mes === mesActual}
        sinTerminar={mesSinTerminar(mes, hoy)}
        filas={filas}
        facturas={facturas}
        marcarFacturado={marcarFacturado}
        deshacerFactura={deshacerFactura}
      />
    </div>
  );
}
