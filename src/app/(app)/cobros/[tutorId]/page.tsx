import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import { connection } from "next/server";
import Link from "next/link";
import { notFound } from "next/navigation";

import { borrarPago, registrarPago } from "@/lib/cobro/acciones-pagos";
import { obtenerCuentaTutor } from "@/lib/cobro/datos";
import { hoyEnAsuncion } from "@/lib/fechas";
import { CuentaTutor } from "./cuenta-tutor";

export const metadata: Metadata = { title: "Cuenta · Consultorio" };

// Cuenta de un tutor (B4): cargos, pagos, imputación FIFO y saldo acumulado.
export default async function Pagina({ params }: PageProps<"/cobros/[tutorId]">) {
  const { tutorId } = await params;
  // La fecha de hoy es de cada pedido: no se arma la página de antemano.
  await connection();
  const hoy = hoyEnAsuncion();
  const datos = await obtenerCuentaTutor(tutorId, hoy);
  if (!datos) notFound();

  return (
    <div className="flex flex-col gap-4">
      <Link href="/cobros" className="flex h-10 items-center gap-1 self-start text-sm text-muted-foreground">
        <ChevronLeft className="size-4" /> Cobros
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight">{datos.tutor.nombre}</h1>
      <CuentaTutor hoy={hoy} tutor={datos.tutor} cuenta={datos.cuenta} registrarPago={registrarPago} borrarPago={borrarPago} />
    </div>
  );
}
