import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

export const POST: APIRoute = async ({ request }) => {
    const { path } = await request.json();

    if (!path) return new Response(JSON.stringify({ error: 'No se proporcionó la ruta del archivo' }), { status: 400 });

    const supabase = createClient(
        import.meta.env.PUBLIC_SUPABASE_URL,
        import.meta.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { error } = await supabase.storage.from('properties').remove([path]);

    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

    return new Response(JSON.stringify({ message: 'Imagen eliminada correctamente' }), { status: 200 });
};
