//configuration.repository.ts
import { supabase } from "@/lib/supabaseClient";
import type { UserProfile } from "../types/UserProfile";

export async function getCurrentUser(userId: string) {
    const response = await supabase
        .from("users")
        .select("full_name, email, avatar_url, account_type, is_verified, whatsapp")
        .eq("id", userId)
        .single();

    return response
}

export async function updateUserRepo(userId: string, data: {
    full_name: string;
    whatsapp: string;
}) {
    return supabase
        .from("users")
        .update(data)
        .eq("id", userId);
}

export async function getLatestRequestStatus(userId: string) {
    return supabase
        .from("account_type")
        .select("status")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
}