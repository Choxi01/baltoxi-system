import { describe, expect, it } from "vitest";
import { linkWhatsApp } from "./whatsapp";

describe("linkWhatsApp", () => {
  it("arma el link con el texto codificado", () => {
    expect(linkWhatsApp("595981000001", "Hola Laura, ¿cómo estás? Gs. 290.000 & más")).toBe(
      "https://wa.me/595981000001?text=Hola%20Laura%2C%20%C2%BFc%C3%B3mo%20est%C3%A1s%3F%20Gs.%20290.000%20%26%20m%C3%A1s",
    );
  });

  it("codifica los saltos de línea", () => {
    expect(linkWhatsApp("595981000001", "a\nb")).toBe("https://wa.me/595981000001?text=a%0Ab");
  });

  it("sin teléfono no hay link", () => {
    expect(linkWhatsApp(null, "Hola")).toBeNull();
    expect(linkWhatsApp(undefined, "Hola")).toBeNull();
    expect(linkWhatsApp("", "Hola")).toBeNull();
    expect(linkWhatsApp("123", "Hola")).toBeNull();
  });

  it("ignora un + o espacios", () => {
    expect(linkWhatsApp("+595 981 000001", "x")).toBe("https://wa.me/595981000001?text=x");
  });
});
