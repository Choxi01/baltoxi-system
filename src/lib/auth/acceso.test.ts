import { describe, expect, it } from "vitest";
import { decidirAcceso, requisitoDeRuta, sesionVerificada } from "./acceso";

const sinSesion = { logueado: false, verificada: false };
const soloContrasena = { logueado: true, verificada: false };
const completa = { logueado: true, verificada: true };

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

describe("decidirAcceso: pedir el código de nuevo", () => {
  it("con la marca de confianza no lo desvía a Hoy (si no, quedaría en un bucle)", () => {
    expect(decidirAcceso("/codigo/pedir", completa)).toEqual({ tipo: "seguir" });
  });
  it("sin sesión, al login", () => {
    expect(decidirAcceso("/codigo/pedir", sinSesion)).toEqual({ tipo: "redirigir", a: "/ingresar" });
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

  it("los envíos (POST) no se desvían por comodidad: si no, se pierde 'recordar este navegador'", () => {
    expect(decidirAcceso("/codigo", completa, false)).toEqual({ tipo: "seguir" });
    expect(decidirAcceso("/ingresar/enviar", completa, false)).toEqual({ tipo: "seguir" });
  });

  it("pero las protecciones valen también para los envíos", () => {
    expect(decidirAcceso("/hoy", sinSesion, false)).toEqual({ tipo: "redirigir", a: "/ingresar" });
    expect(decidirAcceso("/hoy", soloContrasena, false)).toEqual({ tipo: "redirigir", a: "/codigo" });
  });

  it("la ficha pública se ve igual con o sin sesión", () => {
    expect(decidirAcceso("/ficha/abc", completa)).toEqual({ tipo: "seguir" });
  });
});

describe("sesionVerificada", () => {
  const sesion = "11111111-1111-1111-1111-111111111111";

  it("con el código (aal2) está verificada", () => {
    expect(sesionVerificada({ aal: "aal2", session_id: sesion }, undefined)).toBe(true);
  });

  it("solo contraseña: verificada si la marca de confianza es de esta misma sesión", () => {
    expect(sesionVerificada({ aal: "aal1", session_id: sesion }, sesion)).toBe(true);
    expect(sesionVerificada({ aal: "aal1", session_id: sesion }, "otra-sesion")).toBe(false);
    expect(sesionVerificada({ aal: "aal1", session_id: sesion }, undefined)).toBe(false);
  });

  it("sin sesión o sin id de sesión, nunca", () => {
    expect(sesionVerificada(null, sesion)).toBe(false);
    expect(sesionVerificada({ aal: "aal1" }, "")).toBe(false);
  });
});
