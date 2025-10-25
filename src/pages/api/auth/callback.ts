// src/pages/api/auth/callback.ts
import { supabaseServer } from '../../../lib/supabaseServer';

export async function GET({ cookies, request }) {
  try {
    const supabase = supabaseServer(cookies);

    const url = new URL(request.url);
    const code = url.searchParams.get("code");

    if (!code) {
      return new Response("No se encontró el código de autenticación", { status: 400 });
    }

    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error("Error de login Supabase:", error);
      return new Response(JSON.stringify(error), { status: 400 });
    }

    // Sesión creada correctamente → redirige
    return new Response(null, {
      status: 302,
      headers: { Location: "/" },
    });
  } catch (err) {
    console.error("Error interno callback:", err);
    return new Response("Error interno", { status: 500 });
  }
}
