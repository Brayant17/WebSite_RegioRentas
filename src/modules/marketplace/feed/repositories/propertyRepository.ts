import { supabase } from "@/lib/supabaseClient.js";
import type { Filters } from "../types/filters";
 
const PROPERTY_SELECT = `
  id,
  users (is_verified),
  title,
  description,
  price,
  municipio,
  colonia,
  area,
  bedrooms,
  bathrooms,
  operation,
  slug,
  property_type,
  property_images (url, order)
`;

type Result = {
    data: object[];
    error: object | null
}


export async function fetchPropertiesPage({ start, end, filters }: {start:number, end: number, filters: Filters}) {
  let query = supabase
    .from("properties")
    .select(PROPERTY_SELECT)
    .eq("is_public", "TRUE")
    .order("published_at", { ascending: false })
    .order("order", { foreignTable: "property_images", ascending: true })
    .range(start, end);
 
  if (filters.type)      query = query.eq("property_type", filters.type);
  if (filters.operation) query = query.eq("operation", filters.operation);
  if (filters.zone) {
    const zone = filters.zone;
    query = query.or(
      `estado.ilike.%${zone}%,municipio.ilike.%${zone}%,colonia.ilike.%${zone}%,zona.ilike.%${zone}%`
    );
  }
 
  return query; // { data, error }
}
 
export async function fetchFavoritesByUser(userId: string){
  return supabase
    .from("favorites")
    .select("property_id")
    .eq("user_id", userId);
}