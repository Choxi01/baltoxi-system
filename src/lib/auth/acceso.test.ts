import { describe, expect, it } from "vitest";
import { decidirAcceso, requisitoDeRuta } from "./acceso";

const sinSesion = { logueado: false, nivel: null };
const soloContrasena = { logueado: true, nivel: "aal1" };
const completa = { logueado: true, nivel: "aal2" };

describe("requisitoDeRuta", () => {
  it("login y ficha son públicos", () => {
    expect(requisitoDeRuta("/ingresar")).toBe("publico");
    expect(requisitoDeRuta("/ficha/abc-123")).toBe("publico");
  });

  it("la pantalla del código pide solo contraseña", () => {
    expect(requisitoDeRuta("/codigo")).toBe("sesion");
  });

  it("todo lo demás pide sesión completa", () => {
    expect(requisitoDeRuta("/")).toBe("completo");
    expect(requisitoDeRuta("/hoy")).toBe("completo");
    expect(requisitoDeRuta("/pacientes/123")).toBe("completo");
    expect(requisitoDeRuta("/nuevo-consultorio")).toBe("completo");
  });

  it("no se confunde con rutas que solo empiezan parecido", () => {
    expect(requisitoDeRuta("/fichas")).toBe("completo");
    expect(requisitoDeRuta("/ingresarx")).toBe("completo");
  });
});

describe("decidirAcceso", () => {
  it("sin sesión: deja ver lo público y manda el resto al login", () => {
    expect(decidirAcceso("/ingresar", sinSesion)).toEqual({ tipo: "seguir" });
    expect(decidirAcceso("/ficha/abc", sinSesion)).toEqual({ tipo: "seguir" });
    expect(decidirAcceso("/hoy", sinSesion)).toEqual({ tipo: "redirigir", a: "/ingresar" });
    expect(decidirAcceso("/codigo", sinSesion)).toEqual({ tipo: "redirigir", a: "/ingresar" });
  });

  it("con contraseña pero sin código: siempre a la pantalla del código", () => {
    expect(decidirAcceso("/codigo", soloContrasena)).toEqual({ tipo: "seguir" });
    expect(decidirAcceso("/hoy", soloContrasena)).toEqual({ tipo: "redirigir", a: "/codigo" });
    expect(decidirAcceso("/cobros", soloContrasena)).toEqual({ tipo: "redirigir", a: "/codigo" });
  });

  it("con sesión completa: entra a todo y salta login y código", () => {
    expect(decidirAcceso("/hoy", completa)).toEqual({ tipo: "seguir" });
    expect(decidirAcceso("/ingresar", completa)).toEqual({ tipo: "redirigir", a: "/hoy" });
    expect(decidirAcceso("/codigo", completa)).toEqual({ tipo: "redirigir", a: "/hoy" });
  });

  it("la ficha pública se ve igual con o sin sesión", () => {
    expect(decidirAcceso("/ficha/abc", completa)).toEqual({ tipo: "seguir" });
  });
});
