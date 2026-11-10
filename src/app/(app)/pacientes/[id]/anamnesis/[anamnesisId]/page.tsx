import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { obtenerAnamnesis } from "@/lib/anamnesis/datos-anamnesis";
import { textoRespuesta } from "@/lib/anamnesis/respuestas";
import { obtenerPaciente } from "@/lib/pacientes/datos";
import { textoFecha } from "@/lib/pacientes/fecha";
import { BotonImprimir } from "./boton-imprimir";

// Anamnesis para leer e imprimir (tarea A6b). DATOS CLÍNICOS: el título de la pestaña no lleva el
// nombre del paciente (queda en el historial del navegador). Se imprime con el botón del navegador.
export const metadata: Metadata = { title: "Anamnesis · Consultorio" };

export default async function PaginaAnamnesis({ params }: PageProps<"/pacientes/[id]/anamnesis/[anamnesisId]">) {
  const { id, anamnesisId } = await params;
  const [ficha, anamnesis] = await Promise.all([obtenerPaciente(id), obtenerAnamnesis(id, anamnesisId)]);
  if (!ficha || !anamnesis?.estructura) notFound();
  const { paciente } = ficha;

  return (
    <article className="mx-auto flex max-w-3xl flex-col gap-6">
      <Link href={`/pacientes/${id}?pestana=anamnesis`} className="flex h-10 items-center gap-1 text-sm text-muted-foreground print:hidden">
        <ChevronLeft className="size-4" /> Volver al expediente
      </Link>

      <header className="flex flex-col gap-1 border-b pb-4">
        <h1 className="text-2xl font-semibold tracking-tight">
          Anamnesis · {paciente.nombre} {paciente.apellido}
        </h1>
        <p className="text-sm text-muted-foreground">
          {anamnesis.plantilla} · {textoFecha(anamnesis.fecha)}
          {paciente.fecha_nacimiento && ` · Nació el ${textoFecha(paciente.fecha_nacimiento)}`}
        </p>
      </header>

      {anamnesis.estructura.secciones.map((seccion, i) => (
        <section key={i} className="flex flex-col gap-3 break-inside-avoid-page">
          <h2 className="text-lg font-semibold">{seccion.titulo}</h2>
          <dl className="flex flex-col gap-3">
            {seccion.campos.map((campo) => {
              const texto = textoRespuesta(campo, anamnesis.respuestas[campo.id]);
              return (
                <div key={campo.id} className="flex flex-col gap-0.5 break-inside-avoid">
                  <dt className="text-sm font-medium text-muted-foreground">{campo.etiqueta}</dt>
                  <dd className={texto ? "whitespace-pre-wrap break-words" : "text-muted-foreground"}>{texto ?? "—"}</dd>
                </div>
              );
            })}
          </dl>
        </section>
      ))}

      <BotonImprimir />
    </article>
  );
}
