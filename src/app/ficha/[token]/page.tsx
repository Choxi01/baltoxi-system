import type { Metadata } from "next";
import { connection } from "next/server";

import { agregarOtroTutor, firmarReglamento, guardarDatosTutor, guardarHijo } from "@/lib/ficha/acciones";
import { MAXIMO_FALLIDOS_POR_IP, claveFallidos, superaLimite } from "@/lib/ficha/reglas";
import { buscarTutorPorToken, cargarFicha, contarIntentos, hashIpDeLaSolicitud, registrarIntento } from "@/lib/ficha/servidor";
import { hoyEnAsuncion } from "@/lib/fechas";
import { FichaNoDisponible, VistaFicha } from "./vista";

// PÚBLICA: ficha online de la familia (tarea A8a, docs/expediente.md). Todo en el servidor con el
// cliente admin, validando el token y con límite de intentos (regla de oro 10).

export const metadata: Metadata = {
  title: "Ficha de la familia",
  // Que no aparezca en buscadores ni mande el link (con el token) a otras páginas.
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function PaginaFicha({ params }: PageProps<"/ficha/[token]">) {
  await connection();
  const { token } = await params;

  const hashIp = await hashIpDeLaSolicitud();
  if (superaLimite(await contarIntentos(claveFallidos(hashIp)), MAXIMO_FALLIDOS_POR_IP)) {
    return <FichaNoDisponible demasiados />;
  }
  const tutor = await buscarTutorPorToken(token);
  if (!tutor) {
    await registrarIntento(claveFallidos(hashIp));
    return <FichaNoDisponible demasiados={false} />;
  }
  const ficha = await cargarFicha(tutor);

  return (
    <VistaFicha
      ficha={ficha}
      hoy={hoyEnAsuncion()}
      guardarTutor={guardarDatosTutor.bind(null, token)}
      guardarHijo={(pacienteId) => guardarHijo.bind(null, token, pacienteId)}
      agregarOtro={agregarOtroTutor.bind(null, token)}
      firmar={firmarReglamento.bind(null, token, ficha.reglamento.version)}
    />
  );
}
