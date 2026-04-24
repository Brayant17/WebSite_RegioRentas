import { supabase } from "@/lib/supabaseClient";

export async function fetchPropertyBySlug(slug: string) {

    const { data, error } = await supabase
        .from("properties")
        .select(`
                *, 
                property_images (url, order),
                users (full_name, whatsapp)
            `)
        .eq("slug", slug)
        .order("order", { foreignTable: "property_images", ascending: true })
        .maybeSingle<Property>();

    if (error) {
        return { data: null, error: error }
    }

    return { data, error: null }
}


export async function fetchSimilarProperty(property_type: string) {

    const { data, error } = await supabase
        .from("properties")
        .select(`
                id,
                title,
                price,
                estado,
                municipio,
                colonia,
                property_type,
                slug,
                operation,
                property_images ( url ),
                slug
        `)
        .eq("property_type", property_type)
        .limit(4);

    if (error) {
        return { data: null, error: error }
    }

    return { data, error: null }
}