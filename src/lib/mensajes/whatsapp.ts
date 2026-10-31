// Link para abrir WhatsApp con el mensaje escrito (docs/mensajes.md).
// El teléfono se guarda en formato internacional sin "+" (595981123456).

/** `https://wa.me/<telefono>?text=<texto>`, o null si no hay un teléfono que sirva. */
export function linkWhatsApp(telefono: string | null | undefined, texto: string): string | null {
  const digitos = (telefono ?? "").replace(/\D/g, "");
  if (digitos.length < 8) return null;
  return `https://wa.me/${digitos}?text=${encodeURIComponent(texto)}`;
}
