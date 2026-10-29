import { describe, expect, it } from "vitest";
import { cn } from "./utils";

describe("cn", () => {
  it("une clases y la última gana si chocan", () => {
    expect(cn("px-2 py-1", "px-4")).toBe("py-1 px-4");
  });

  it("ignora valores vacíos", () => {
    expect(cn("a", false, undefined, "b")).toBe("a b");
  });
});
