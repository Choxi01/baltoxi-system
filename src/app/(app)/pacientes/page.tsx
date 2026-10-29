import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Plus, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { hoyEnAsuncion } from "@/lib/fechas";
import { estadoDeFiltro, filtrarPacientes, NOMBRE_ESTADO, ESTADOS_PACIENTE } from "@/lib/pacientes/busqueda";
import { listarPacientes } from "@/lib/pacientes/datos";
import { textoEdad } from "@/lib/pacientes/edad";

export const metadata: Metadata = { title: "Pacientes · Consultorio" };

export default async function PaginaPacientes({ searchParams }: PageProps<"/pacientes">) {
  const parametros = await searchParams;
  const q = typeof parametros.q === "string" ? parametros.q : "";
  const estado = estadoDeFiltro(typeof parametros.estado === "string" ? parametros.estado : undefined);

  const todos = await listarPacientes();
  const pacientes = filtrarPacientes(todos, { q, estado });
  const hoy = hoyEnAsuncion();

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

      {/* Formulario común (GET): funciona igual con o sin JavaScript. */}
      <form role="search" className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
          <Input name="q" type="search" defaultValue={q} placeholder="Buscar por nombre o apellido" className="pl-10" aria-label="Buscar" />
        </div>
        <div className="flex gap-2">
          <Select name="estado" defaultValue={estado} aria-label="Estado" className="sm:w-40">
            {ESTADOS_PACIENTE.map((e) => (
              <option key={e} value={e}>
                {e === "activo" ? "Activos" : NOMBRE_ESTADO[e]}
              </option>
            ))}
            <option value="todos">Todos</option>
          </Select>
          <Button type="submit" size="touch" variant="secondary">
            Buscar
          </Button>
        </div>
      </form>

      {pacientes.length === 0 ? (
        <p className="py-8 text-center text-muted-foreground">
          {todos.length === 0 ? "Todavía no cargaste pacientes." : "No hay pacientes que coincidan."}
        </p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {pacientes.map((p) => (
            <li key={p.id}>
              <Link href={`/pacientes/${p.id}`} className="flex min-h-16 items-center gap-3 px-4 py-2 active:bg-accent">
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-medium">
                    {p.nombre} {p.apellido}
                  </span>
                  <span className="truncate text-sm text-muted-foreground">
                    {[textoEdad(p.fecha_nacimiento, hoy), p.responsable && `Paga: ${p.responsable}`]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </div>
                {p.estado !== "activo" && (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    {NOMBRE_ESTADO[p.estado as keyof typeof NOMBRE_ESTADO] ?? p.estado}
                  </span>
                )}
                <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
      )}
      <p className="text-sm text-muted-foreground">
        {pacientes.length} {pacientes.length === 1 ? "paciente" : "pacientes"}
      </p>
    </div>
  );
}
