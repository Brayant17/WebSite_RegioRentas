"use client";

import { supabase } from "@/lib/supabaseClient";
import { useEffect, useState } from "react";
import { DataTable } from "@/components/admin/User/table/data-table";
import { getColumns } from "@/components/admin/User/table/columns";
import { UserFilters } from "@/components/admin/User/filters/UserFilters";
import { CSVExportButton } from "@/components/admin/User/table/CSVExportButton";
import { PaginationControls } from "@/components/admin/User/table/PaginationControls";
import { UserDetailsModal } from "@/components/admin/User/modals/UserDetailsModal"
import type { User } from "./types";
import { Toaster } from "@/components/ui/sonner";


export default function UsersPage() {

    const [selectedUser, setSelectedUser] = useState<User | null>(null)
    const [openModal, setOpenModal] = useState<null | "details" | "edit" | "delete" | "suspend">(null)

    const [users, setUsers] = useState<any[]>([]);
    const [filters, setFilters] = useState({ email: "", role: "", status: "" });
    const [page, setPage] = useState(1);

    const limit = 10; // registros por página
    const [totalPages, setTotalPages] = useState(1);

    const columns = getColumns({
        onEdit: (user) => {
            setSelectedUser(user)
            setOpenModal("edit")
        },
        onViewDetails: (user) => {
            setSelectedUser(user)
            setOpenModal("details")
        },
        onSuspend: (user) => {
            setSelectedUser(user)
            setOpenModal("suspend")
        },
        onDelete: (user) => {
            setSelectedUser(user)
            setOpenModal("delete")
        },
    })

    useEffect(() => {
        loadUsers();
    }, [filters, page]);

    async function loadUsers() {
        let query = supabase
            .from("users")
            .select("*", { count: "exact" });

        if (filters.email) query = query.ilike("email", `%${filters.email}%`);
        if (filters.role) query = query.eq("role", filters.role);
        if (filters.status) query = query.eq("approval_status", filters.status);

        const start = (page - 1) * limit;
        const end = start + limit - 1;

        const { data, count, error } = await query.range(start, end);

        if (error) {
            console.error("Error al cargar usuarios:", error);
            return;
        }

        setUsers(data);
        setTotalPages(Math.ceil(count! / limit));
    }

    return (
        <div className="p-6 space-y-4">
            <h1 className="text-2xl font-bold">Usuarios</h1>

            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <UserFilters
                    onFilter={(f: any) => {
                        setPage(1);
                        setFilters(f);
                    }}
                    className="w-full md:w-auto"
                />

                <CSVExportButton data={users} className="w-full md:w-auto" />
            </div>

            <div className="overflow-hidden rounded-lg border">
                <DataTable columns={columns} data={users} />
            </div>

            <PaginationControls
                page={page}
                totalPages={totalPages}
                onPageChange={(p) => setPage(p)}
            />

            <UserDetailsModal
                open={openModal === "details"}
                user={selectedUser}
                onClose={() => setOpenModal(null)}
            />

        </div>
    );
}
