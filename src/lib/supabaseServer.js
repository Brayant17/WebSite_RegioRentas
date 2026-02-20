import { createServerClient } from "@supabase/ssr";

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL
const supabaseServiceKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY

export function supabaseServer(cookies) {
    return createServerClient(
        supabaseUrl,
        supabaseServiceKey,
        {
            cookies: {
                get: (key) => cookies.get(key)?.value,
                set: (key, value, options) => cookies.set(key, value, options),
                remove: (key, options) => cookies.delete(key, options),
            }
        }
    );
}


// Funcionalidad anterior (viejita)
// export function supabaseServer(request, response) {
//     const supabase = createServerClient(
//         supabaseUrl,
//         supabaseAnonKey,
//         {
//             cookies: {
//                 get: (key) => cookies.get(key)?.value ?? '', // 👈 Aquí se usa el API de Astro correctamente
//                 set: (key, value, options) => {
//                     cookies.set(key, value, {
//                         ...options,
//                         httpOnly: true,
//                         secure: true,
//                         sameSite: 'lax',
//                     });
//                 },
//                 remove: (key) => cookies.delete(key),
//             },
//         }
//     )

//     return supabase
// }