import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { hoyEnAsuncion } from "@/lib/fechas";
import { estadoDeFiltro, ordenDeFiltro } from "@/lib/pacientes/busqueda";
import { listarPacientes } from "@/lib/pacientes/datos";
import { ListaPacientes } from "./lista-pacientes";

export const metadata: Metadata = { title: "Pacientes · Consultorio" };

export default async function PaginaPacientes({ searchParams }: PageProps<"/pacientes">) {
  const parametros = await searchParams;
  const texto = (clave: string) => (typeof parametros[clave] === "string" ? (parametros[clave] as string) : undefined);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Pacientes</h1>
        <Button asChild size="touch">
          <Link href="/pacientes/nuevo">
            <Plus /> Nuevo
          </Link>
        </Button>
      </div>
      {/* Se cargan todos una vez; buscar, filtrar y ordenar pasa en el teléfono, sin recargar. */}
      <ListaPacientes
        pacientes={await listarPacientes()}
        hoy={hoyEnAsuncion()}
        inicial={{
          q: texto("q") ?? "",
          estado: estadoDeFiltro(texto("estado")),
          orden: ordenDeFiltro(texto("orden")),
        }}
      />
    </div>
  );
}
