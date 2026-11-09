import { iconoApp } from "@/components/app/icono-app";

// Ícono de "Agregar a pantalla de inicio" (iPhone, iPad) y "Agregar al Dock" (Mac).
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return iconoApp(180);
}
