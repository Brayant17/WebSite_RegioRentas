import { supabase } from "@/lib/supabaseClient"

export async function fetchUserProperties({ userId, from, to }: { userId: string; from: number; to: number }) {
    const { data, error, count } = await supabase
        .from("properties")
        .select(`
    *,
    property_images:property_images(url, order)
  `, { count: "exact" })
        .eq("user_id", userId)
        .order("id", { ascending: false })
        .range(from, to)
        .limit(1, { foreignTable: "property_images" });


    if (error) {
        throw error;
    }

    return data;
}
