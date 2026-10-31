import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { ChevronRight } from "lucide-react";

import { BotonSalir } from "@/components/app/boton-salir";
import { Contador } from "@/components/app/menu";
import { contarPendientes } from "@/lib/mensajes/datos";
import { SECCIONES } from "@/lib/navegacion";

export const metadata: Metadata = { title: "Más · Consultorio" };

// En iPhone, las secciones que no entran en la barra de abajo.
export default async function PaginaMas() {
  // El contador usa la fecha de hoy: se calcula en cada visita.
  await connection();
  const pendientes = await contarPendientes();
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">Más</h1>
      <ul className="divide-y rounded-lg border">
        {SECCIONES.filter((s) => !s.principal).map((s) => (
          <li key={s.href}>
            <Link href={s.href} className="flex h-14 items-center justify-between px-4 text-base active:bg-accent">
              <span className="flex items-center gap-2">
                {s.titulo}
                {s.href === "/mensajes" && <Contador cantidad={pendientes} />}
              </span>
              <ChevronRight className="size-5 text-muted-foreground" />
            </Link>
          </li>
        ))}
      </ul>
      <BotonSalir className="h-14 w-full rounded-lg border px-4 text-base text-destructive" />
    </div>
  );
}
