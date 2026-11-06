import "server-only";

import { createHmac } from "node:crypto";
import { headers } from "next/headers";

import { crearClienteAdmin } from "@/lib/supabase/admin";
import { esTokenValido, inicioDeVentana } from "./reglas";

// Ficha online (tarea A8a): todo en el servidor con el cliente admin (no hay usuario logueado).
// Cada consulta pide SOLO columnas administrativas: un dato clínico ni siquiera llega a la página.

/** Hash de la IP o del token: nunca se guardan tal cual. La clave es la service role (solo servidor). */
export function hashSecreto(valor: string): string {
  const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!clave) throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY (ver .env.example)");
  return createHmac("sha256", clave).update(valor).digest("hex").slice(0, 32);
}

/** IP de quien abre la ficha (Netlify la manda en x-nf-client-connection-ip). */
export async function hashIpDeLaSolicitud(): Promise<string> {
  const h = await headers();
  const ip = h.get("x-nf-client-connection-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "desconocida";
  return hashSecreto(ip);
}

/** Cuántos intentos con esa clave hubo en la última hora. */
export async function contarIntentos(clave: string): Promise<number> {
  const admin = crearClienteAdmin();
  const { count } = await admin
    .from("intentos_publicos")
    .select("id", { count: "exact", head: true })
    .eq("clave", clave)
    .gte("en", inicioDeVentana(new Date()));
  return count ?? 0;
}

/** Anota un intento y borra los de esa clave que tienen más de un día. */
export async function registrarIntento(clave: string): Promise<void> {
  const admin = crearClienteAdmin();
  await admin.from("intentos_publicos").insert({ clave });
  await admin
    .from("intentos_publicos")
    .delete()
    .eq("clave", clave)
    .lt("en", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
}

export type TutorFicha = {
  id: string;
  consultorio_id: string;
  nombre: string;
  apellido: string | null;
  telefono_wa: string | null;
  email: string | null;
  doc_tipo: string | null;
  doc_numero: string | null;
  dv: string | null;
  razon_social: string | null;
};

/** El tutor de ese link (activo), o null. Columnas administrativas solamente. */
export async function buscarTutorPorToken(token: string): Promise<TutorFicha | null> {
  if (!esTokenValido(token)) return null;
  const admin = crearClienteAdmin();
  const { data } = await admin
    .from("tutores")
    .select("id, consultorio_id, nombre, apellido, telefono_wa, email, doc_tipo, doc_numero, dv, razon_social, activo")
    .eq("token_ficha", token)
    .maybeSingle();
  if (!data || !data.activo) return null;
  return {
    id: data.id,
    consultorio_id: data.consultorio_id,
    nombre: data.nombre,
    apellido: data.apellido,
    telefono_wa: data.telefono_wa,
    email: data.email,
    doc_tipo: data.doc_tipo,
    doc_numero: data.doc_numero,
    dv: data.dv,
    razon_social: data.razon_social,
  };
}

export type FichaFamilia = {
  tutor: TutorFicha;
  consultorio: { nombre: string; profesional: string | null };
  hijos: { id: string; nombre: string; apellido: string | null; fecha_nacimiento: string | null; colegio: string | null; parentesco: string }[];
  /** Los otros tutores de sus hijos: solo nombre y parentesco (sin teléfonos ni documentos). */
  otros: { nombre: string; parentesco: string; hijo: string }[];
};

/** Todo lo que muestra la ficha. Nunca: motivo de consulta, notas, anamnesis, documentos, tarifas, cobros ni turnos. */
export async function cargarFicha(tutor: TutorFicha): Promise<FichaFamilia> {
  const admin = crearClienteAdmin();
  const [{ data: consultorio }, { data: vinculos }] = await Promise.all([
    admin.from("consultorios").select("nombre, profesional").eq("id", tutor.consultorio_id).single(),
    admin.from("paciente_tutores").select("paciente_id, parentesco").eq("consultorio_id", tutor.consultorio_id).eq("tutor_id", tutor.id),
  ]);
  const ids = (vinculos ?? []).map((v) => v.paciente_id);
  const [{ data: pacientes }, { data: otrosVinculos }] = ids.length
    ? await Promise.all([
        admin
          .from("pacientes")
          .select("id, nombre, apellido, fecha_nacimiento, colegio")
          .eq("consultorio_id", tutor.consultorio_id)
          .in("id", ids)
          .order("nombre"),
        admin
          .from("paciente_tutores")
          .select("paciente_id, tutor_id, parentesco")
          .eq("consultorio_id", tutor.consultorio_id)
          .in("paciente_id", ids)
          .neq("tutor_id", tutor.id),
      ])
    : [{ data: [] }, { data: [] }];
  const idsOtros = [...new Set((otrosVinculos ?? []).map((v) => v.tutor_id))];
  const { data: otrosTutores } = idsOtros.length
    ? await admin.from("tutores").select("id, nombre, apellido").eq("consultorio_id", tutor.consultorio_id).in("id", idsOtros)
    : { data: [] };

  const parentesco = new Map((vinculos ?? []).map((v) => [v.paciente_id, v.parentesco]));
  const nombreTutor = new Map((otrosTutores ?? []).map((t) => [t.id, `${t.nombre} ${t.apellido ?? ""}`.trim()]));
  const nombreHijo = new Map((pacientes ?? []).map((p) => [p.id, p.nombre]));

  return {
    tutor,
    consultorio: { nombre: consultorio?.nombre ?? "", profesional: consultorio?.profesional ?? null },
    hijos: (pacientes ?? []).map((p) => ({ ...p, parentesco: parentesco.get(p.id) ?? "" })),
    otros: (otrosVinculos ?? []).map((v) => ({
      nombre: nombreTutor.get(v.tutor_id) ?? "",
      parentesco: v.parentesco,
      hijo: nombreHijo.get(v.paciente_id) ?? "",
    })),
  };
}
