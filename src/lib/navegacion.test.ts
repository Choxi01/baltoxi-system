import { describe, expect, it } from "vitest";
import { SECCIONES, seccionActiva } from "./navegacion";

describe("seccionActiva", () => {
  it("marca la sección y lo que está adentro", () => {
    expect(seccionActiva("/pacientes", "/pacientes")).toBe(true);
    expect(seccionActiva("/pacientes/123", "/pacientes")).toBe(true);
  });

  it("no marca secciones que solo empiezan parecido", () => {
    expect(seccionActiva("/hoyx", "/hoy")).toBe(false);
    expect(seccionActiva("/agenda", "/hoy")).toBe(false);
  });
});

describe("SECCIONES", () => {
  it("la barra del iPhone tiene Hoy, Agenda, Pacientes y Cobros (más el botón Más)", () => {
    expect(SECCIONES.filter((s) => s.principal).map((s) => s.titulo)).toEqual([
      "Hoy",
      "Agenda",
      "Pacientes",
      "Cobros",
    ]);
  });
});
