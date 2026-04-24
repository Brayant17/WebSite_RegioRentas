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
