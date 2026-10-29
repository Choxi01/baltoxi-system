"use client";

import Link from "next/link";
import { ChevronRight, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  ESTADOS_PACIENTE,
  filtrarPacientes,
  NOMBRE_ESTADO,
  ORDENES,
  ordenarPacientes,
  type EstadoPaciente,
  type Orden,
} from "@/lib/pacientes/busqueda";
import { textoEdad } from "@/lib/pacientes/edad";

type Paciente = {
  id: string;
  nombre: string;
  apellido: string | null;
  fecha_nacimiento: string | null;
  estado: string;
  creado_en: string;
  responsable: string | null;
};

type Filtro = { q: string; estado: EstadoPaciente | "todos"; orden: Orden };

export function ListaPacientes({ pacientes, hoy, inicial }: { pacientes: Paciente[]; hoy: string; inicial: Filtro }) {
  const [filtro, setFiltro] = useState(inicial);

  const visibles = useMemo(
    () => ordenarPacientes(filtrarPacientes(pacientes, filtro), filtro.orden),
    [pacientes, filtro],
  );

  // Cambia el filtro al instante y lo guarda en la dirección (sin recargar),
  // así al volver atrás desde un paciente queda como estaba.
  function cambiar(cambio: Partial<Filtro>) {
    const nuevo = { ...filtro, ...cambio };
    setFiltro(nuevo);
    const parametros = new URLSearchParams();
    if (nuevo.q) parametros.set("q", nuevo.q);
    if (nuevo.estado !== "activo") parametros.set("estado", nuevo.estado);
    if (nuevo.orden !== "apellido") parametros.set("orden", nuevo.orden);
    const busqueda = parametros.toString();
    window.history.replaceState(null, "", busqueda ? `?${busqueda}` : window.location.pathname);
  }

  return (
    <>
      <form
        role="search"
        className="flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          (document.activeElement as HTMLElement | null)?.blur(); // cierra el teclado del iPhone
        }}
      >
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={filtro.q}
            onChange={(e) => cambiar({ q: e.target.value })}
            placeholder="Buscar por nombre o apellido"
            className="pl-10"
            aria-label="Buscar"
            enterKeyHint="search"
          />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <Select
            value={filtro.estado}
            onChange={(e) => cambiar({ estado: e.target.value as Filtro["estado"] })}
            aria-label="Estado"
            className="sm:w-40"
          >
            {ESTADOS_PACIENTE.map((e) => (
              <option key={e} value={e}>
                {e === "activo" ? "Activos" : NOMBRE_ESTADO[e]}
              </option>
            ))}
            <option value="todos">Todos</option>
          </Select>
          <Select
            value={filtro.orden}
            onChange={(e) => cambiar({ orden: e.target.value as Orden })}
            aria-label="Ordenar por"
            className="sm:w-52"
          >
            {Object.entries(ORDENES).map(([valor, texto]) => (
              <option key={valor} value={valor}>
                {texto}
              </option>
            ))}
          </Select>
        </div>
      </form>

      {visibles.length === 0 ? (
        <p className="py-8 text-center text-muted-foreground">
          {pacientes.length === 0 ? "Todavía no cargaste pacientes." : "No hay pacientes que coincidan."}
        </p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {visibles.map((p) => (
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
                    {NOMBRE_ESTADO[p.estado as EstadoPaciente] ?? p.estado}
                  </span>
                )}
                <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
      )}
      <p className="text-sm text-muted-foreground">
        {visibles.length} {visibles.length === 1 ? "paciente" : "pacientes"}
      </p>
    </>
  );
}
