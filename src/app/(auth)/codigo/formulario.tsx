"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RUTA_INGRESAR, RUTA_INICIO } from "@/lib/auth/acceso";
import { confiarEnEsteDispositivo } from "@/lib/auth/acciones";
import { codigoCompleto, limpiarCodigo } from "@/lib/auth/codigo";
import { crearClienteNavegador } from "@/lib/supabase/navegador";

type Paso =
  | { tipo: "cargando" }
  | { tipo: "error"; mensaje: string }
  // Primera vez: hay que agregar la cuenta a la app Autenticador.
  | { tipo: "activar"; factorId: string; qr: string; secreto: string; uri: string }
  // Ya está activado: solo pedir el código.
  | { tipo: "verificar"; factorId: string };

// Prepara el paso: si ya hay un Autenticador verificado, pide el código;
// si no, borra intentos a medias y genera un QR nuevo.
async function prepararPaso(): Promise<Paso> {
  const mfa = crearClienteNavegador().auth.mfa;
  const { data, error } = await mfa.listFactors();
  if (error) return { tipo: "error", mensaje: "No se pudo cargar. Probá de nuevo." };

  const verificado = data.totp[0];
  if (verificado) return { tipo: "verificar", factorId: verificado.id };

  for (const factor of data.all) {
    if (factor.factor_type === "totp" && factor.status === "unverified") {
      await mfa.unenroll({ factorId: factor.id });
    }
  }
  const alta = await mfa.enroll({ factorType: "totp", friendlyName: "Consultorio" });
  if (alta.error) return { tipo: "error", mensaje: "No se pudo generar el código QR. Probá de nuevo." };
  return {
    tipo: "activar",
    factorId: alta.data.id,
    qr: alta.data.totp.qr_code,
    secreto: alta.data.totp.secret,
    uri: alta.data.totp.uri,
  };
}

export function FormularioCodigo() {
  const [paso, setPaso] = useState<Paso>({ tipo: "cargando" });
  const [codigo, setCodigo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    let vigente = true;
    prepararPaso().then((nuevo) => {
      if (vigente) setPaso(nuevo);
    });
    return () => {
      vigente = false;
    };
  }, []);

  async function confirmar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (paso.tipo !== "activar" && paso.tipo !== "verificar") return;
    if (!codigoCompleto(codigo)) {
      setError("El código tiene 6 números.");
      return;
    }
    setEnviando(true);
    setError(null);
    const { error } = await crearClienteNavegador().auth.mfa.challengeAndVerify({
      factorId: paso.factorId,
      code: codigo,
    });
    if (error) {
      setEnviando(false);
      setCodigo("");
      setError("El código no es correcto o ya cambió. Mirá el Autenticador y probá de nuevo.");
      return;
    }
    // Este navegador queda de confianza por 30 días (la próxima vez alcanza
    // con la contraseña). Si falla, igual se entra: solo pedirá el código otra vez.
    try {
      await confiarEnEsteDispositivo();
    } catch {}
    // Recarga completa para que el servidor vea la sesión con el código.
    window.location.replace(RUTA_INICIO);
  }

  async function cancelar() {
    setEnviando(true);
    await crearClienteNavegador().auth.signOut();
    window.location.replace(RUTA_INGRESAR);
  }

  if (paso.tipo === "cargando") {
    return <p className="text-center text-muted-foreground">Cargando…</p>;
  }
  if (paso.tipo === "error") {
    return (
      <div className="flex flex-col gap-4 text-center">
        <p role="alert" className="text-destructive">
          {paso.mensaje}
        </p>
        <Button size="touch" onClick={() => window.location.reload()}>
          Reintentar
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={confirmar} className="flex flex-col gap-6">
      <div className="flex flex-col gap-1 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          {paso.tipo === "activar" ? "Activá el código de seguridad" : "Código de seguridad"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {paso.tipo === "activar"
            ? "Es un paso extra para proteger los datos de tus pacientes. Lo hacés una sola vez."
            : "Abrí la app Autenticador y escribí el código de 6 números."}
        </p>
      </div>

      {paso.tipo === "activar" && (
        <ol className="flex list-decimal flex-col gap-4 pl-5 text-sm">
          <li>
            En el iPhone, tocá el botón para agregar la cuenta a Contraseñas o a tu app
            Autenticador.
            <Button asChild variant="outline" size="touch" className="mt-2 w-full">
              <a href={paso.uri}>Agregar al Autenticador</a>
            </Button>
          </li>
          <li>
            Si estás en otra pantalla (iPad o Mac), escaneá este código con la cámara del iPhone:
            <Image
              src={paso.qr}
              alt="Código QR para la app Autenticador"
              width={176}
              height={176}
              unoptimized
              className="mx-auto mt-2 rounded-lg bg-white p-2"
            />
          </li>
          <li>
            ¿No funciona? Cargá esta clave a mano:
            <code className="mt-1 block select-all break-all rounded-md bg-muted p-2 font-mono text-xs">
              {paso.secreto}
            </code>
          </li>
          <li>Escribí abajo el código de 6 números que te muestra.</li>
        </ol>
      )}

      <div className="flex flex-col gap-2">
        <Label htmlFor="codigo">Código</Label>
        <Input
          id="codigo"
          name="codigo"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          placeholder="123456"
          value={codigo}
          onChange={(e) => setCodigo(limpiarCodigo(e.target.value))}
          className="text-center text-2xl tracking-[0.4em]"
          autoFocus
          required
        />
      </div>
      {paso.tipo === "verificar" && (
        <p className="text-xs text-muted-foreground">
          En el iPhone, si guardaste el código en Contraseñas, tocá el campo y elegí el código
          que te sugiere arriba del teclado.
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" size="touch" disabled={enviando}>
        {enviando ? "Verificando…" : "Confirmar"}
      </Button>
      <Button type="button" variant="ghost" onClick={cancelar} disabled={enviando}>
        Cancelar y salir
      </Button>
    </form>
  );
}
