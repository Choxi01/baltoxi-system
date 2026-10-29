import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { formatoGs } from "@/lib/cobro/formato";
import { hoyEnAsuncion } from "@/lib/fechas";
import { actualizarPaciente } from "@/lib/pacientes/acciones";
import { NOMBRE_ESTADO, type EstadoPaciente } from "@/lib/pacientes/busqueda";
import { listarTarifas, obtenerPaciente } from "@/lib/pacientes/datos";
import { textoEdad } from "@/lib/pacientes/edad";
import { textoFecha } from "@/lib/pacientes/fecha";
import { NOMBRE_PLAN, PLANES_COBRO } from "@/lib/pacientes/validacion";
import { FichaDatos, type FilaResumen } from "./ficha-datos";
import { Pestanas } from "./pestanas";

export const metadata: Metadata = { title: "Paciente · Consultorio" };

export default async function PaginaPaciente({ params, searchParams }: PageProps<"/pacientes/[id]">) {
  const { id } = await params;
  const { pestana } = await searchParams;

  const [ficha, tarifas] = await Promise.all([obtenerPaciente(id), listarTarifas()]);
  if (!ficha) notFound();
  const { paciente, tutores } = ficha;
  const hoy = hoyEnAsuncion();
  const edad = textoEdad(paciente.fecha_nacimiento, hoy);
  const nombreDe = (t: { nombre: string; apellido: string | null }) => `${t.nombre} ${t.apellido ?? ""}`.trim();

  const tarifa = tarifas.find((t) => t.id === paciente.tarifa_id);
  const responsable = tutores.find((t) => t.id === paciente.responsable_pago_id);
  const plan = paciente.plan_cobro as (typeof PLANES_COBRO)[number];
  const resumen: FilaResumen[] = [
    {
      etiqueta: "Fecha de nacimiento",
      valor: paciente.fecha_nacimiento ? `${textoFecha(paciente.fecha_nacimiento)} (${edad})` : null,
    },
    { etiqueta: "Colegio", valor: paciente.colegio },
    { etiqueta: "Derivado por", valor: paciente.derivado_por },
    { etiqueta: "Motivo de consulta", valor: paciente.motivo_consulta, clinico: true },
    { etiqueta: "Estado", valor: NOMBRE_ESTADO[paciente.estado as EstadoPaciente] ?? paciente.estado },
    { etiqueta: "Tarifa", valor: tarifa ? `${tarifa.nombre} · ${formatoGs(tarifa.monto_gs)}` : null },
    {
      etiqueta: "Precio especial",
      valor: paciente.monto_override_gs != null ? formatoGs(paciente.monto_override_gs) : null,
    },
    { etiqueta: "Forma de pago", valor: NOMBRE_PLAN[plan] ?? paciente.plan_cobro },
    { etiqueta: "Responsable de pago", valor: responsable ? nombreDe(responsable) : null },
  ];

  const proximamente = (tarea: string) => <p className="text-muted-foreground">Próximamente (tarea {tarea}).</p>;

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
          {[edad, NOMBRE_ESTADO[paciente.estado as EstadoPaciente]].filter(Boolean).join(" · ")}
        </p>
      </div>

      <Pestanas
        inicial={typeof pestana === "string" ? pestana : "datos"}
        pestanas={[
          {
            id: "datos",
            titulo: "Datos",
            contenido: (
              <FichaDatos
                resumen={resumen}
                accion={actualizarPaciente.bind(null, paciente.id)}
                valores={paciente}
                tarifas={tarifas}
                tutores={tutores}
                hoy={hoy}
              />
            ),
          },
          {
            id: "tutores",
            titulo: "Tutores",
            contenido: (
              <div className="flex flex-col gap-3">
                {tutores.length === 0 ? (
                  <p className="text-muted-foreground">Este paciente todavía no tiene tutores.</p>
                ) : (
                  <ul className="divide-y rounded-lg border">
                    {tutores.map((t) => (
                      <li key={t.id} className="flex flex-col px-4 py-3">
                        <span className="font-medium">
                          {nombreDe(t)}
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
            ),
          },
          { id: "anamnesis", titulo: "Anamnesis", contenido: proximamente("A6") },
          { id: "notas", titulo: "Notas", contenido: proximamente("A5") },
          { id: "documentos", titulo: "Documentos", contenido: proximamente("A7") },
          { id: "cuenta", titulo: "Turnos y cuenta", contenido: proximamente("B4") },
        ]}
      />
    </div>
  );
}
