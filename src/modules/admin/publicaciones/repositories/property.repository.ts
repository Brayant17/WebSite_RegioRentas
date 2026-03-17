import { supabase } from "@/lib/supabaseClient";

export async function listProperties(
    filters: any = {},
    page: number = 1,
    limit: number = 10
) {
    const from = (page - 1) * limit; // cálculo del offset
    const to = from + limit - 1; // cálculo del límite
    let query = supabase
        .from("properties")
        .select("id, id_owner:user_id, title, slug, property_type, price, status, published_at", { count: "exact" })
        .order("published_at", { ascending: false });

    if (filters.title) {
        query = query.ilike("title", `%${filters.title}%`);
    }
    if (filters.slug) {
        query = query.ilike("slug", `%${filters.slug}%`);
    }
    if (filters.property_type) {
        query = query.eq("property_type", filters.property_type);
    }
    if (filters.status) {
        query = query.eq("status", filters.status);
    }

    const { data, count, error } = await query.range(from, to);

    if (error) {
        throw new Error(error.message);
    }
    return { data: data ?? [], count: count ?? 0 };
}