import { iconoApp } from "@/components/app/icono-app";

// Genera /icon/192 y /icon/512 (los usa manifest.ts).
export function generateImageMetadata() {
  return [192, 512].map((lado) => ({ id: String(lado), size: { width: lado, height: lado }, contentType: "image/png" }));
}

export default async function Icon({ id }: { id: Promise<string> }) {
  return iconoApp(Number(await id));
}
