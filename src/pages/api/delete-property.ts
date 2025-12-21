// src/pages/api/eliminar-propiedad.ts
import { createClient } from '@supabase/supabase-js';
import type { APIRoute } from 'astro';

// Cliente admin (para operaciones elevadas como borrar del storage)
const supabaseAdmin = createClient(
    import.meta.env.PUBLIC_SUPABASE_URL!,
    import.meta.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Cliente "público" para verificar sesión del usuario
const supabasePublic = createClient(
    import.meta.env.PUBLIC_SUPABASE_URL!,
    import.meta.env.PUBLIC_SUPABASE_ANON_KEY!
);

export const POST: APIRoute = async ({ request }) => {
    try {
        const { propiedadId } = await request.json();
        const authHeader = request.headers.get('authorization');

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return new Response(JSON.stringify({ error: 'No autorizado' }), {
                status: 401,
            });
        }

        const token = authHeader.replace('Bearer ', '');

        // Validar token y obtener usuario
        const { data: userData, error: userError } = await supabasePublic.auth.getUser(token);

        if (userError || !userData.user) {
            return new Response(JSON.stringify({ error: 'Token inválido o expirado.' }), {
                status: 401,
            });
        }

        const user = userData.user;
        const userId = user.id;
        const isAdmin = user.user_metadata?.role === 'admin';

        // 1. Verificar que la propiedad le pertenece al usuario
        const { data: propiedad, error: propError } = await supabaseAdmin
            .from('properties')
            .select('id, user_id') // asegúrate de usar el campo correcto
            .eq('id', propiedadId)
            .single();

        if (propError || !propiedad) {
            return new Response(JSON.stringify({ error: 'Propiedad no encontrada.' }), {
                status: 404,
            });
        }

        if (propiedad.user_id !== userId && !isAdmin) {
            return new Response(JSON.stringify({ error: 'No tienes permiso para eliminar esta propiedad.' }), {
                status: 403,
            });
        }

        // 2. Obtener imágenes relacionadas
        const { data: imagenes, error: imagenesError } = await supabaseAdmin
            .from('property_images')
            .select('url')
            .eq('property_id', propiedadId);

        if (imagenesError) {
            return new Response(JSON.stringify({ error: 'Error obteniendo imágenes.', detalle: imagenesError.message }), {
                status: 500,
            });
        }

        // 3. Eliminar archivos del Storage
        if (imagenes && imagenes.length > 0) {
            const rutas = imagenes.map((img) => img.url);

            const { error: storageError } = await supabaseAdmin
                .storage
                .from('properties') // cambia si tu bucket se llama distinto
                .remove(rutas);

            if (storageError) {
                return new Response(JSON.stringify({ error: 'Error eliminando archivos del storage.', detalle: storageError.message }), {
                    status: 500,
                });
            }
        }

        // 4. Eliminar propiedad (y sus imágenes con ON DELETE CASCADE)
        const { error: deletePropError } = await supabaseAdmin
            .from('properties')
            .delete()
            .eq('id', propiedadId);

        if (deletePropError) {
            return new Response(JSON.stringify({ error: 'Error eliminando la propiedad.', detalle: deletePropError.message }), {
                status: 500,
            });
        }

        return new Response(JSON.stringify({ mensaje: 'Propiedad eliminada correctamente.' }), {
            status: 200,
        });

    } catch (error) {
        return new Response(JSON.stringify({ error: 'Error inesperado.', detalle: (error as Error).message }), {
            status: 500,
        });
    }
};
