// user.repository.ts
import { supabase } from "@/lib/supabaseClient"
import type { User, UserFilters } from "../types"

export async function listUsers(
    filters: UserFilters = {},
    page: number = 1,
    limit: number = 10
) {
    const from = (page - 1) * limit // cálculo del offset
    const to = from + limit - 1 // cálculo del límite

    let query = supabase
        .from("users")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })

    if (filters.email) {
        query = query.ilike("email", `%${filters.email}%`)
    }

    if (filters.role) {
        query = query.eq("role", filters.role)
    }

    if (filters.account_type) {
        query = query.eq("account_type", filters.account_type)
    }

    if (filters.is_verified !== undefined && filters.is_verified !== "") {
        query = query.eq("is_verified", filters.is_verified === "true")
    }

    const { data, count, error } = await query.range(from, to)

    if (error) {
        throw new Error(error.message)
    }

    return { data: data ?? [], count: count ?? 0 }
}

export async function listPendingRequest() {
    const { data, error } = await supabase
        .rpc("get_latest_pending_requests")

    if (error) {
        throw new Error(error.message)
    }

    return { data: data ?? [], error: error ?? null }
}

export async function deleteUser(id: string) {
    const { error } = await supabase
        .from("users")
        .delete()
        .eq("id", id)

    if (error) {
        throw new Error(error.message)
    }
}

export async function findPendingVerificationRequests() {
    return await supabase
        .from("account_requests")
        .select(`
            id,
            status,
            created_at,
            requested_type,

            user:users!account_requests_user_id_fkey(
                id,
                full_name,
                email
            ),

            account_request_documents(
                id,
                document_type,
                storage_path,
                file_name
            )
        `)
        .eq("requested_type", "identity_verification")
        .eq("status", "pending")
        .order("created_at", {
            ascending: false
        });
}

export async function createSignedDocumentUrls(
    paths: string[],
    expiresIn = 60 * 30
) {
    return await supabase.storage
        .from("verification-documents")
        .createSignedUrls(paths, expiresIn);
}