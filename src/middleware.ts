// src/middleware.ts
import { defineMiddleware } from "astro/middleware";
import { supabaseServer } from "./lib/supabaseServer.js";

export const onRequest = defineMiddleware(async (context, next) => {
    const supabase = supabaseServer(context.cookies);
    const {
        data: { user },
    } = await supabase.auth.getUser();

    const currentPath = context.url.pathname;

    // 🔒 rutas que requieren autenticación
    const protectedRoutes = [
        "/panel/favoritos",
        "/panel/publicaciones",
        "/panel/configuracion",
    ];

    // 🔒 rutas que requieren permiso broker
    const protectedRoutesBroker = [
        "/panel/publicaciones/nueva",
        "/panel/publicaciones/editar",
    ];

    // 🔒 rutas exclusivas del administrador
    const protectedRoutesAdmin = ["/admin"];

    // 1️⃣ Bloquear rutas protegidas si no hay usuario
    if (!user && protectedRoutes.some((route) => currentPath.startsWith(route))) {
        console.log("⛔ Sin usuario, redirigiendo a /login");
        return context.redirect("/login");
    }

    // 2️⃣ Verificar aprobación de broker
    if (user && protectedRoutesBroker.some((route) => currentPath.startsWith(route))) {
        const { data: approvalData, error: approvalError } = await supabase
            .from("users")
            .select("approval_status")
            .eq("id", user.id)
            .single();

        if (approvalError) {
            console.error("Error al verificar aprobación:", approvalError);
            return context.redirect("/panel/favoritos"); // fallback seguro
        }

        const isApproved = approvalData?.approval_status === "approved";
        if (!isApproved) {
            console.log("⛔ Usuario no aprobado, redirigiendo a /panel/publicaciones");
            return context.redirect("/panel/publicaciones");
        }
    }

    // 3️⃣ Verificar rol de administrador desde tu tabla users
    if (protectedRoutesAdmin.some((route) => currentPath.startsWith(route))) {
        if (!user) {
            console.log("⛔ Sin usuario, redirigiendo a /login");
            return context.redirect("/login");
        }

        // 🔍 Consultar el rol del usuario en la tabla users
        const { data: roleData, error: roleError } = await supabase
            .from("users")
            .select("role")
            .eq("id", user.id)
            .single();

        if (roleError) {
            console.error("Error al obtener rol del usuario:", roleError);
            return context.redirect("/"); // fallback seguro
        }

        const role = roleData?.role;

        if (role !== "admin") {
            console.log("⛔ Acceso denegado: usuario sin rol admin");
            return context.redirect("/");
        }
    }

    // ✅ Si todo está correcto, continúa
    return next();
});
