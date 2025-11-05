// src/middleware.ts
import { defineMiddleware } from 'astro/middleware'
import { supabaseServer } from './lib/supabaseServer.js'

export const onRequest = defineMiddleware(async (context, next) => {
    const supabase = supabaseServer(context.cookies)
    const { data: { user } } = await supabase.auth.getUser()

    // rutas que requieren autenticacion
    const protectedRoutes = ['/panel/favoritos', '/panel/publicaciones', '/panel/configuracion']

    // Proteger rutas bajo /dashboard
    if (!user && protectedRoutes.some(route => context.url.pathname.startsWith(route))) {
        console.log('Redirigiendo a /login (no hay usuario)') // 👈 útil para debug
        return context.redirect('/login')
    }
    

    return next();
})