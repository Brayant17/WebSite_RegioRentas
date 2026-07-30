import { createServerClient } from "@supabase/ssr";
import type { AstroCookies } from "astro";

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL
const supabaseServiceKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY

export function supabaseServer(cookies: AstroCookies) {
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