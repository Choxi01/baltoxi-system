import { describe, expect, it } from "vitest";
import { estadoDeFiltro, filtrarPacientes, normalizar, ordenarPacientes, ordenDeFiltro } from "./busqueda";

const pacientes = [
  { nombre: "Mateo", apellido: "Benítez", estado: "activo" },
  { nombre: "Valentina", apellido: "Benítez", estado: "pausa" },
  { nombre: "Thiago", apellido: "Giménez", estado: "activo" },
  { nombre: "Ana", apellido: null, estado: "alta" },
];

describe("normalizar", () => {
  it("saca tildes, mayúsculas y espacios de más", () => {
    expect(normalizar("  Benítez  Núñez ")).toBe("benitez nunez");
  });
});

describe("filtrarPacientes", () => {
  it("busca sin importar tildes ni mayúsculas", () => {
    expect(filtrarPacientes(pacientes, { q: "benitez", estado: "todos" }).map((p) => p.nombre)).toEqual([
      "Mateo",
      "Valentina",
    ]);
    expect(filtrarPacientes(pacientes, { q: "GIMÉ", estado: "todos" })).toHaveLength(1);
  });

  it("todas las palabras tienen que aparecer", () => {
    expect(filtrarPacientes(pacientes, { q: "mateo benitez", estado: "todos" })).toHaveLength(1);
    expect(filtrarPacientes(pacientes, { q: "mateo gimenez", estado: "todos" })).toHaveLength(0);
  });

  it("filtra por estado", () => {
    expect(filtrarPacientes(pacientes, { estado: "activo" }).map((p) => p.nombre)).toEqual(["Mateo", "Thiago"]);
    expect(filtrarPacientes(pacientes, { estado: "alta" }).map((p) => p.nombre)).toEqual(["Ana"]);
  });

});

describe("ordenarPacientes", () => {
  const lista = [
    { nombre: "Thiago", apellido: "Giménez", estado: "activo", fecha_nacimiento: "2019-09-01", creado_en: "2026-10-01" },
    { nombre: "Mateo", apellido: "Benítez", estado: "activo", fecha_nacimiento: "2020-07-15", creado_en: "2026-10-03" },
    { nombre: "Ana", apellido: null, estado: "alta", fecha_nacimiento: null, creado_en: "2026-10-02" },
    { nombre: "Valentina", apellido: "Benítez", estado: "activo", fecha_nacimiento: "2022-02-10", creado_en: "2026-09-30" },
  ];
  const nombres = (orden: Parameters<typeof ordenarPacientes>[1]) => ordenarPacientes(lista, orden).map((p) => p.nombre);

  it("por apellido (sin apellido primero) y por nombre", () => {
    expect(nombres("apellido")).toEqual(["Ana", "Mateo", "Valentina", "Thiago"]);
    expect(nombres("nombre")).toEqual(["Ana", "Mateo", "Thiago", "Valentina"]);
  });

  it("por edad, y sin fecha al final", () => {
    expect(nombres("menor")).toEqual(["Valentina", "Mateo", "Thiago", "Ana"]);
    expect(nombres("mayor")).toEqual(["Thiago", "Mateo", "Valentina", "Ana"]);
  });

  it("últimos cargados primero", () => {
    expect(nombres("recientes")).toEqual(["Mateo", "Ana", "Thiago", "Valentina"]);
  });

  it("no cambia la lista original", () => {
    ordenarPacientes(lista, "menor");
    expect(lista[0].nombre).toBe("Thiago");
  });

  it("orden por defecto: apellido", () => {
    expect(ordenDeFiltro(undefined)).toBe("apellido");
    expect(ordenDeFiltro("raro")).toBe("apellido");
    expect(ordenDeFiltro("menor")).toBe("menor");
  });
});

describe("estadoDeFiltro", () => {
  it("por defecto muestra los activos", () => {
    expect(estadoDeFiltro(undefined)).toBe("activo");
    expect(estadoDeFiltro("cualquiera")).toBe("activo");
    expect(estadoDeFiltro("todos")).toBe("todos");
    expect(estadoDeFiltro("pausa")).toBe("pausa");
  });
});
