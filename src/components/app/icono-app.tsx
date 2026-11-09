import { ImageResponse } from "next/og";

// Ícono de la app instalada (iPhone, iPad, Mac y Android): cuadrado turquesa con una C blanca.
// Se dibuja al compilar, así no hace falta guardar PNG en el repo. Si hay logo, se reemplaza acá.
// Sin esquinas redondeadas: cada sistema las recorta a su manera.
export function iconoApp(lado: number) {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0b7a78",
          color: "#ffffff",
          fontSize: lado * 0.62,
          fontWeight: 700,
        }}
      >
        C
      </div>
    ),
    { width: lado, height: lado },
  );
}
