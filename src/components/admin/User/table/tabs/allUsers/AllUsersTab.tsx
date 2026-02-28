import { useEffect, useState } from "react";
import { getColumns } from "../allUsers/columns";
import { supabase } from "@/lib/supabaseClient";
import { DataTable } from "../../data-table";
import { CSVExportButton } from "../../CSVExportButton";
import { UserFilters } from "../../../filters/UserFilters";
import { UserDetailsModal } from "../../../modals/UserDetailsModal";
import type { User } from "../../../types";

export default function AllUsersTab() {

    const [users, setUsers] = useState<any[]>([]);
    const [filters, setFilters] = useState({ email: "", role: "", status: "" });
    const [page, setPage] = useState(1);

    const [openModal, setOpenModalState] = useState<null | "details" | "edit" | "delete" | "suspend">(null)
    const [selectedUser, setSelectedUser] = useState<User | null>(null)
    
    const limit = 10; // registros por página
    const [totalPages, setTotalPages] = useState(1);
    const columns = getColumns({
        onEdit: (user) => {
            setSelectedUser(user)
            setOpenModalState("edit")
        },
        onViewDetails: (user) => {
            setSelectedUser(user)
            setOpenModalState("details")
        },
        onSuspend: (user) => {
            setSelectedUser(user)
            setOpenModalState("suspend")
        },
        onDelete: (user) => {
            setSelectedUser(user)
            setOpenModalState("delete")
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
        <div className="flex flex-col gap-2">
            
            <UserDetailsModal
                open={openModal === "details"}
                user={selectedUser}
                onClose={() => setOpenModalState(null)}
                onUserUpdated={loadUsers}
            />
            <div className="flex flex-wrap gap-2 justify-end">
                <UserFilters
                    onFilter={(f: any) => {
                        setPage(1);
                        setFilters(f);
                    }}
                    className="w-full md:w-auto"
                />
                <CSVExportButton fileName="all-Users" data={users} className="w-full md:w-auto" />
            </div>
            <DataTable columns={columns} data={users} />
        </div>
    );
}