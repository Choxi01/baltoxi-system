"use client";

import { useRef, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ResultadoMensaje } from "@/lib/mensajes/acciones";
import {
  CUANDO_SE_USA,
  DESCRIPCION_VARIABLE,
  LARGO_MAXIMO_PLANTILLA,
  TITULO_PLANTILLA,
  VARIABLES_POR_CLAVE,
  actualizarRecordatorio,
  tieneMananaViejo,
  variablesDesconocidas,
  vistaPrevia,
  type Clave,
} from "@/lib/mensajes/plantillas";

type Guardar = (clave: string, texto: string) => Promise<ResultadoMensaje>;

// Configuración → Mensajes (B5): editar cada plantilla con sus variables y una vista previa
// con datos de ejemplo. Sin datos clínicos: las variables solo traen nombres, días, horas y montos.
export function TabMensajes({ plantillas, guardar }: { plantillas: { clave: Clave; texto: string }[]; guardar: Guardar }) {
  return (
    <div className="flex flex-col gap-6 pt-4">
      <p className="text-sm text-muted-foreground">
        Tocá una variable para agregarla donde está el cursor. Al mandar, cada variable se cambia por el dato de esa familia.
      </p>
      {plantillas.map((p) => (
        <EditorPlantilla key={p.clave} clave={p.clave} guardado={p.texto} guardar={guardar} />
      ))}
    </div>
  );
}

function EditorPlantilla({ clave, guardado, guardar }: { clave: Clave; guardado: string; guardar: Guardar }) {
  const [texto, setTexto] = useState(guardado);
  const [base, setBase] = useState(guardado);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [guardando, iniciar] = useTransition();
  const area = useRef<HTMLTextAreaElement>(null);
  const id = `plantilla-${clave}`;

  const desconocidas = variablesDesconocidas(texto, clave);
  const mananaViejo = clave === "recordatorio_sesion" && tieneMananaViejo(texto);
  const cambiado = texto !== base;

  function cambiar(nuevo: string) {
    setTexto(nuevo);
    setError(null);
    setAviso(null);
  }

  function insertar(variable: string) {
    const el = area.current;
    const marca = `{${variable}}`;
    const desde = el?.selectionStart ?? texto.length;
    const hasta = el?.selectionEnd ?? texto.length;
    cambiar(texto.slice(0, desde) + marca + texto.slice(hasta));
    // Después de React: dejar el cursor justo después de la variable.
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(desde + marca.length, desde + marca.length);
    });
  }

  function enviar() {
    iniciar(async () => {
      const r = await guardar(clave, texto);
      if (r.ok) {
        const limpio = texto.replace(/\r\n/g, "\n").trim();
        setTexto(limpio);
        setBase(limpio);
        setAviso("Guardado ✓");
      } else setError(r.error);
    });
  }

  return (
    <section className="flex flex-col gap-3 rounded-lg border p-3">
      <div>
        <Label htmlFor={id} className="text-base font-semibold">
          {TITULO_PLANTILLA[clave]}
        </Label>
        <p className="text-sm text-muted-foreground">{CUANDO_SE_USA[clave]}</p>
      </div>
      <Textarea
        ref={area}
        id={id}
        value={texto}
        onChange={(e) => cambiar(e.target.value)}
        maxLength={LARGO_MAXIMO_PLANTILLA}
        rows={4}
        aria-invalid={desconocidas.length > 0 || !!error}
      />
      <div className="flex flex-wrap gap-2" role="group" aria-label="Variables">
        {VARIABLES_POR_CLAVE[clave].map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => insertar(v)}
            title={DESCRIPCION_VARIABLE[v]}
            className="h-10 rounded-full border bg-muted px-3 font-mono text-sm active:bg-accent"
          >
            {`{${v}}`}
          </button>
        ))}
      </div>

      {mananaViejo && (
        <div className="flex flex-col gap-2 rounded-md bg-amber-100 px-3 py-2 text-sm text-amber-950 dark:bg-amber-950 dark:text-amber-100">
          <p>
            Esta plantilla dice «mañana», pero el viernes se recuerdan los turnos del lunes. Cambiala por {"{cuando}"}, que pone «mañana»
            o «el lunes 2/11» según el día. (Mientras tanto, al mandar se cambia sola.)
          </p>
          <Button variant="outline" className="h-11 self-start bg-background" onClick={() => cambiar(actualizarRecordatorio(texto))}>
            Actualizar
          </Button>
        </div>
      )}
      {desconocidas.length > 0 && (
        <p role="alert" className="text-sm text-destructive">
          {desconocidas.length === 1 ? "Esta variable no existe" : "Estas variables no existen"}:{" "}
          {desconocidas.map((v) => `{${v}}`).join(", ")}
        </p>
      )}

      <div className="flex flex-col gap-1">
        <p className="text-xs font-medium text-muted-foreground">Vista previa (datos de ejemplo)</p>
        <p className="whitespace-pre-wrap rounded-lg bg-muted/60 p-3 text-sm">{vistaPrevia(texto, clave)}</p>
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex items-center gap-3">
        <Button className="h-12" onClick={enviar} disabled={guardando || !cambiado || !texto.trim() || desconocidas.length > 0}>
          {guardando ? "Guardando…" : "Guardar"}
        </Button>
        {cambiado && !guardando && (
          <Button variant="ghost" className="h-12" onClick={() => cambiar(base)}>
            Deshacer cambios
          </Button>
        )}
        {aviso && !cambiado && (
          <p role="status" className="text-sm text-muted-foreground">
            {aviso}
          </p>
        )}
      </div>
    </section>
  );
}
