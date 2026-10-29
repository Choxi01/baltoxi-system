import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { actualizarPaciente } from "@/lib/pacientes/acciones";
import { NOMBRE_ESTADO } from "@/lib/pacientes/busqueda";
import { listarTarifas, obtenerPaciente } from "@/lib/pacientes/datos";
import { textoEdad } from "@/lib/pacientes/edad";
import { hoyEnAsuncion } from "@/lib/fechas";
import { cn } from "@/lib/utils";
import { FormularioPaciente } from "../formulario-paciente";

export const metadata: Metadata = { title: "Paciente · Consultorio" };

const PESTANAS = [
  { id: "datos", titulo: "Datos" },
  { id: "tutores", titulo: "Tutores" },
  { id: "anamnesis", titulo: "Anamnesis", tarea: "A6" },
  { id: "notas", titulo: "Notas", tarea: "A5" },
  { id: "documentos", titulo: "Documentos", tarea: "A7" },
  { id: "cuenta", titulo: "Turnos y cuenta", tarea: "B4" },
] as const;

export default async function PaginaPaciente({ params, searchParams }: PageProps<"/pacientes/[id]">) {
  const { id } = await params;
  const { pestana } = await searchParams;
  const actual = PESTANAS.find((p) => p.id === pestana) ?? PESTANAS[0];

  const ficha = await obtenerPaciente(id);
  if (!ficha) notFound();
  const { paciente, tutores } = ficha;
  const edad = textoEdad(paciente.fecha_nacimiento, hoyEnAsuncion());

  return (
    <div className="flex flex-col gap-4">
      <Link href="/pacientes" className="flex h-10 items-center gap-1 text-sm text-muted-foreground">
        <ChevronLeft className="size-4" /> Pacientes
      </Link>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {paciente.nombre} {paciente.apellido}
        </h1>
        <p className="text-sm text-muted-foreground">
          {[edad, NOMBRE_ESTADO[paciente.estado as keyof typeof NOMBRE_ESTADO]].filter(Boolean).join(" · ")}
        </p>
      </div>

      {/* Pestañas: links comunes, se pueden deslizar en el iPhone. */}
      <nav aria-label="Secciones del expediente" className="-mx-4 overflow-x-auto px-4">
        <ul className="flex min-w-max gap-1 border-b">
          {PESTANAS.map((p) => (
            <li key={p.id}>
              <Link
                href={`/pacientes/${id}?pestana=${p.id}`}
                replace
                aria-current={p.id === actual.id ? "page" : undefined}
                className={cn(
                  "flex h-11 items-center border-b-2 px-3 text-sm font-medium",
                  p.id === actual.id ? "border-foreground text-foreground" : "border-transparent text-muted-foreground",
                )}
              >
                {p.titulo}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {actual.id === "datos" && (
        <FormularioPaciente
          accion={actualizarPaciente.bind(null, paciente.id)}
          valores={paciente}
          tarifas={await listarTarifas()}
          tutores={tutores}
          textoBoton="Guardar cambios"
        />
      )}

      {actual.id === "tutores" && (
        <div className="flex flex-col gap-3">
          {tutores.length === 0 ? (
            <p className="text-muted-foreground">Este paciente todavía no tiene tutores.</p>
          ) : (
            <ul className="divide-y rounded-lg border">
              {tutores.map((t) => (
                <li key={t.id} className="flex flex-col px-4 py-3">
                  <span className="font-medium">
                    {t.nombre} {t.apellido}
                    {t.id === paciente.responsable_pago_id && (
                      <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">Paga</span>
                    )}
                  </span>
                  <span className="text-sm text-muted-foreground">{t.parentesco}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="text-sm text-muted-foreground">Agregar y editar tutores: próximamente (tarea A1b).</p>
        </div>
      )}

      {"tarea" in actual && (
        <p className="text-muted-foreground">Próximamente (tarea {actual.tarea}).</p>
      )}
    </div>
  );
}
