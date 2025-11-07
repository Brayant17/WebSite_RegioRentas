// src/middleware.ts
import { defineMiddleware } from "astro/middleware";
import { supabaseServer } from "./lib/supabaseServer.js";

export const onRequest = defineMiddleware(async (context, next) => {
    const supabase = supabaseServer(context.cookies);
    const {
        data: { user },
    } = await supabase.auth.getUser();

    // rutas que requieren autenticación
    const protectedRoutes = [
        "/panel/favoritos",
        "/panel/publicaciones",
        "/panel/configuracion",
    ];

    // rutas que requieren autorización (broker)
    const protectedRoutesBroker = [
        "/panel/publicaciones/nueva",
        "/panel/publicaciones/editar",
    ];

    const currentPath = context.url.pathname;

    // Bloquear rutas protegidas si no hay usuario
    if (!user && protectedRoutes.some((route) => currentPath.startsWith(route))) {
        console.log("⛔ Sin usuario, redirigiendo a /login");
        return context.redirect("/login");
    }

    // ✅ Si hay usuario, verificamos si necesita permiso de broker
    if (user && protectedRoutesBroker.some((route) => currentPath.startsWith(route))) {
        const { data: approvalData, error: approvalError } = await supabase
            .from("users")
            .select("approval_status")
            .eq("id", user.id)
            .single();

        if (approvalError) {
            return context.redirect("/panel/favoritos"); // fallback seguro
        }

        const isApproved = approvalData?.approval_status === "approved";

        if (!isApproved) {
            return context.redirect("/panel/publicaciones");
        }
    }

    // ✅ Si todo está correcto, continúa
    return next();
});
