import { describe, expect, it } from "vitest";
import {
  aBorrador,
  agregarCampo,
  agregarSeccion,
  borradorVacio,
  cambiarCampo,
  cambiarNombre,
  cambiarTitulo,
  desdeBorrador,
  hayCambios,
  moverCampo,
  moverSeccion,
  opcionesDesdeTexto,
  quitarCampo,
  quitarSeccion,
} from "./borrador";
import { validarPlantilla, type Estructura } from "./estructura";

// Datos inventados.
const claves = () => {
  let n = 0;
  return () => `k${n++}`;
};

const ejemplo: Estructura = {
  secciones: [
    {
      titulo: "Embarazo y parto",
      campos: [
        { id: "embarazo", etiqueta: "¿Cómo fue el embarazo?", tipo: "largo" },
        { id: "parto_tipo", etiqueta: "Tipo de parto", tipo: "opciones", opciones: ["Natural", "Cesárea"] },
      ],
    },
    { titulo: "Desarrollo", campos: [{ id: "camino", etiqueta: "¿Caminó antes del año?", tipo: "si_no" }] },
  ],
};

describe("aBorrador y desdeBorrador", () => {
  it("ida y vuelta da la misma estructura", () => {
    const b = aBorrador("Infantil", ejemplo, claves());
    expect(b.secciones[0].campos[1].opcionesTexto).toBe("Natural\nCesárea");
    expect(desdeBorrador(b)).toEqual({ nombre: "Infantil", estructura: ejemplo });
  });

  it("cada sección y campo tiene su clave para la pantalla", () => {
    const b = aBorrador("Infantil", ejemplo, claves());
    const todas = b.secciones.flatMap((s) => [s.clave, ...s.campos.map((c) => c.clave)]);
    expect(new Set(todas).size).toBe(todas.length);
  });

  it("los campos nuevos reciben un id con la pregunta, sin repetir los que existen", () => {
    const clave = claves();
    let b = aBorrador("Infantil", ejemplo, clave);
    b = agregarCampo(b, 1, clave);
    b = cambiarCampo(b, 1, 1, { etiqueta: "¿Cómo fue el embarazo?" });
    b = agregarCampo(b, 1, clave);
    b = cambiarCampo(b, 1, 2, { etiqueta: "¿Cómo fue el embarazo?" });
    const ids = desdeBorrador(b).estructura.secciones[1].campos.map((c) => c.id);
    expect(ids).toEqual(["camino", "como_fue_el_embarazo", "como_fue_el_embarazo_2"]);
  });

  it("renombrar un campo existente no le cambia el id", () => {
    let b = aBorrador("Infantil", ejemplo, claves());
    b = cambiarCampo(b, 0, 0, { etiqueta: "Embarazo: ¿hubo complicaciones?" });
    expect(desdeBorrador(b).estructura.secciones[0].campos[0]).toEqual({
      id: "embarazo",
      etiqueta: "Embarazo: ¿hubo complicaciones?",
      tipo: "largo",
    });
  });

  it("las opciones se guardan solo si el tipo es opciones", () => {
    let b = aBorrador("Infantil", ejemplo, claves());
    b = cambiarCampo(b, 0, 1, { tipo: "texto" });
    expect(desdeBorrador(b).estructura.secciones[0].campos[1]).toEqual({ id: "parto_tipo", etiqueta: "Tipo de parto", tipo: "texto" });
    // Si vuelve a "opciones", las opciones siguen ahí.
    b = cambiarCampo(b, 0, 1, { tipo: "opciones" });
    expect(desdeBorrador(b).estructura.secciones[0].campos[1].opciones).toEqual(["Natural", "Cesárea"]);
  });
});

describe("opcionesDesdeTexto", () => {
  it("una por renglón, sin vacíos ni espacios de más", () => {
    expect(opcionesDesdeTexto(" Natural \n\nCesárea\r\n  \nFórceps")).toEqual(["Natural", "Cesárea", "Fórceps"]);
    expect(opcionesDesdeTexto("")).toEqual([]);
  });
});

describe("operaciones del editor", () => {
  it("una plantilla nueva arranca con una sección y una pregunta vacías", () => {
    const b = borradorVacio(claves());
    expect(b.nombre).toBe("");
    expect(b.secciones).toHaveLength(1);
    expect(b.secciones[0].campos).toEqual([{ clave: "k1", id: null, etiqueta: "", tipo: "texto", opcionesTexto: "" }]);
    // Vacía no se puede guardar.
    expect(validarPlantilla(desdeBorrador(b)).ok).toBe(false);
  });

  it("arma una plantilla completa desde cero que se puede guardar", () => {
    const clave = claves();
    let b = cambiarNombre(borradorVacio(clave), "Anamnesis inventada");
    b = cambiarTitulo(b, 0, "Datos generales");
    b = cambiarCampo(b, 0, 0, { etiqueta: "¿Con quién vive?" });
    b = agregarCampo(b, 0, clave);
    b = cambiarCampo(b, 0, 1, { etiqueta: "Lateralidad", tipo: "opciones", opcionesTexto: "Diestro\nZurdo" });
    b = agregarSeccion(b, clave);
    b = cambiarTitulo(b, 1, "Salud");
    b = cambiarCampo(b, 1, 0, { etiqueta: "¿Usa audífonos?", tipo: "si_no" });
    const r = validarPlantilla(desdeBorrador(b));
    expect(r).toEqual({
      ok: true,
      datos: {
        nombre: "Anamnesis inventada",
        estructura: {
          secciones: [
            {
              titulo: "Datos generales",
              campos: [
                { id: "con_quien_vive", etiqueta: "¿Con quién vive?", tipo: "texto" },
                { id: "lateralidad", etiqueta: "Lateralidad", tipo: "opciones", opciones: ["Diestro", "Zurdo"] },
              ],
            },
            { titulo: "Salud", campos: [{ id: "usa_audifonos", etiqueta: "¿Usa audífonos?", tipo: "si_no" }] },
          ],
        },
      },
    });
  });

  it("sube y baja secciones y campos", () => {
    const b = aBorrador("Infantil", ejemplo, claves());
    expect(moverSeccion(b, 1, -1).secciones.map((s) => s.titulo)).toEqual(["Desarrollo", "Embarazo y parto"]);
    expect(moverCampo(b, 0, 0, 1).secciones[0].campos.map((c) => c.id)).toEqual(["parto_tipo", "embarazo"]);
    // En el borde no pasa nada.
    expect(moverCampo(b, 0, 0, -1).secciones[0].campos.map((c) => c.id)).toEqual(["embarazo", "parto_tipo"]);
  });

  it("quita secciones y campos", () => {
    const b = aBorrador("Infantil", ejemplo, claves());
    expect(quitarSeccion(b, 0).secciones.map((s) => s.titulo)).toEqual(["Desarrollo"]);
    expect(quitarCampo(b, 0, 1).secciones[0].campos.map((c) => c.id)).toEqual(["embarazo"]);
  });

  it("nunca cambia el borrador anterior", () => {
    const b = aBorrador("Infantil", ejemplo, claves());
    const antes = JSON.stringify(b);
    moverSeccion(b, 0, 1);
    quitarCampo(b, 0, 0);
    cambiarCampo(b, 0, 0, { etiqueta: "x" });
    cambiarTitulo(b, 0, "x");
    agregarCampo(b, 0, claves());
    expect(JSON.stringify(b)).toBe(antes);
  });
});

describe("hayCambios", () => {
  it("detecta cambios reales e ignora las claves de pantalla", () => {
    const original = aBorrador("Infantil", ejemplo, claves());
    const otraVez = aBorrador("Infantil", ejemplo, () => "otra");
    expect(hayCambios(original, otraVez)).toBe(false);
    expect(hayCambios(original, cambiarTitulo(original, 0, "Otro"))).toBe(true);
    expect(hayCambios(original, moverSeccion(original, 0, 1))).toBe(true);
  });
});
