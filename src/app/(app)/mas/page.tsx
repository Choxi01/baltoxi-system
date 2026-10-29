import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { BotonSalir } from "@/components/app/boton-salir";
import { SECCIONES } from "@/lib/navegacion";

export const metadata: Metadata = { title: "Más · Consultorio" };

// En iPhone, las secciones que no entran en la barra de abajo.
export default function PaginaMas() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">Más</h1>
      <ul className="divide-y rounded-lg border">
        {SECCIONES.filter((s) => !s.principal).map((s) => (
          <li key={s.href}>
            <Link href={s.href} className="flex h-14 items-center justify-between px-4 text-base active:bg-accent">
              {s.titulo}
              <ChevronRight className="size-5 text-muted-foreground" />
            </Link>
          </li>
        ))}
      </ul>
      <BotonSalir className="h-14 w-full rounded-lg border px-4 text-base text-destructive" />
    </div>
  );
}
