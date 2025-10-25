// src/pages/api/auth/signin.ts
import type { APIRoute } from "astro";
import { supabaseServer } from "../../../lib/supabaseServer"; // 👈 usa el server, no el client
import type { Provider } from "@supabase/supabase-js";

export const POST: APIRoute = async ({ request, cookies, redirect, url }) => {
    const formData = await request.formData();
    const email = formData.get("email")?.toString();
    const password = formData.get("password")?.toString();
    const provider = formData.get("provider")?.toString();

    // inicializa el cliente SSR (tiene acceso a cookies seguras)
    const supabase = supabaseServer(cookies);

    const validProviders = ["google"];

    // 🔹 Caso 1: login con OAuth (Google, GitHub, etc)
    if (provider && validProviders.includes(provider)) {
        const { data, error } = await supabase.auth.signInWithOAuth({
            provider: provider as Provider,
            options: {
                redirectTo: `${url.origin}/api/auth/callback`, // tu endpoint de callback
            },
        });

        if (error) {
            console.error("Error OAuth:", error);
            return new Response(error.message, { status: 500 });
        }

        // redirige a la URL de Google (login)
        return Response.redirect(data.url, 302);
    }

    // 🔹 Caso 2: login con email y password
    if (!email || !password) {
        return new Response("Correo electrónico y contraseña obligatorios", {
            status: 400,
        });
    }

    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
    });

    if (error) {
        return new Response(error.message, { status: 403 });
    }

    // guarda tokens en cookies seguras
    const { access_token, refresh_token } = data.session;

    cookies.set("sb-access-token", access_token, {
        path: "/",
        httpOnly: true,
        sameSite: "lax",
    });

    cookies.set("sb-refresh-token", refresh_token, {
        path: "/",
        httpOnly: true,
        sameSite: "lax",
    });

    return redirect("/");
};
