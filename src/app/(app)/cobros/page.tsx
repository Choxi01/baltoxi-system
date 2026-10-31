import type { Metadata } from "next";
import { connection } from "next/server";

import { registrarPago } from "@/lib/cobro/acciones-pagos";
import { listarQuienDebe, listarTutoresParaPago } from "@/lib/cobro/datos";
import { hoyEnAsuncion } from "@/lib/fechas";
import { ListaCobros } from "./lista-cobros";

export const metadata: Metadata = { title: "Cobros · Consultorio" };

// Cobros (B4): quién debe, con atraso según docs/reglas-cobro.md §5, y saldo a favor.
export default async function Pagina() {
  // La fecha de hoy es de cada pedido: no se arma la página de antemano.
  await connection();
  const hoy = hoyEnAsuncion();
  const [{ filas, totales }, tutores] = await Promise.all([listarQuienDebe(hoy), listarTutoresParaPago()]);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">Cobros</h1>
      <ListaCobros hoy={hoy} filas={filas} totales={totales} tutores={tutores} registrarPago={registrarPago} />
    </div>
  );
}
