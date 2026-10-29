// Variables públicas de Supabase (van al navegador; no son secretas).
// Se leen con el nombre completo para que Next.js las pueda incrustar.
export function supabaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) throw new Error("Falta NEXT_PUBLIC_SUPABASE_URL (ver .env.example)");
  return url;
}

export function supabaseAnonKey(): string {
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!key) throw new Error("Falta NEXT_PUBLIC_SUPABASE_ANON_KEY (ver .env.example)");
  return key;
}
