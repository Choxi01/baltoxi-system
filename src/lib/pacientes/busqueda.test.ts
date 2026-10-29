import { describe, expect, it } from "vitest";
import { estadoDeFiltro, filtrarPacientes, normalizar } from "./busqueda";

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

  it("ordena por apellido y nombre", () => {
    expect(filtrarPacientes(pacientes, { estado: "todos" }).map((p) => p.nombre)).toEqual([
      "Ana",
      "Mateo",
      "Valentina",
      "Thiago",
    ]);
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
