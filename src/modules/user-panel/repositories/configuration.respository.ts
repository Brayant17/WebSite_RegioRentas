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

export async function getLatestBrokerRequest(userId: string) {
    return supabase
        .from("account_requests")
        .select("status")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
}

export async function getLatestVerificationRequest(userId: string) {
    return supabase
        .from("account_requests")
        .select("status")
        .eq("user_id", userId)
        .eq("requested_type", "identity_verification")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
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

export async function getLatestRequest(
    userId: string,
    requestedType: string
) {
    return supabase
        .from("account_requests")
        .select("status")
        .eq("user_id", userId)
        .eq("requested_type", requestedType)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
}

export async function requestAccountPremium() {
    return supabase.functions.invoke("request_account_upgrade", {
        body: {
            requested_type: "premium"
        }
    });
}