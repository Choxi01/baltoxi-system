// Achicar una foto en el dispositivo antes de subirla (docs/expediente.md): lado mayor 2000 px,
// JPEG calidad 0,8. Solo corre en el navegador (usa canvas). Las medidas salen de
// `medidasAchicadas`, que tiene tests. Safari ya gira la foto según cómo se sacó (EXIF).

import { CALIDAD_JPEG, LADO_MAXIMO, medidasAchicadas } from "./reglas";

function cargarImagen(archivo: Blob): Promise<HTMLImageElement> {
  return new Promise((resolver, rechazar) => {
    const url = URL.createObjectURL(archivo);
    const imagen = new Image();
    imagen.onload = () => {
      URL.revokeObjectURL(url);
      resolver(imagen);
    };
    imagen.onerror = () => {
      URL.revokeObjectURL(url);
      rechazar(new Error("No se pudo abrir la imagen."));
    };
    imagen.src = url;
  });
}

/** Devuelve la foto como JPEG achicado. Falla si el navegador no sabe abrir ese formato. */
export async function achicarImagen(archivo: Blob): Promise<Blob> {
  const imagen = await cargarImagen(archivo);
  const { ancho, alto } = medidasAchicadas(imagen.naturalWidth, imagen.naturalHeight, LADO_MAXIMO);
  const lienzo = document.createElement("canvas");
  lienzo.width = ancho;
  lienzo.height = alto;
  const contexto = lienzo.getContext("2d");
  if (!contexto) throw new Error("No se pudo preparar la imagen.");
  // Fondo blanco: una imagen con transparencia (PNG) no queda negra en JPEG.
  contexto.fillStyle = "#ffffff";
  contexto.fillRect(0, 0, ancho, alto);
  contexto.drawImage(imagen, 0, 0, ancho, alto);
  return new Promise((resolver, rechazar) =>
    lienzo.toBlob((blob) => (blob ? resolver(blob) : rechazar(new Error("No se pudo preparar la imagen."))), "image/jpeg", CALIDAD_JPEG),
  );
}
