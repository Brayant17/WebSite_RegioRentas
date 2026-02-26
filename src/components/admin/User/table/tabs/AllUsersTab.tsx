import { useEffect, useState } from "react";
import { getColumns } from "../columns";
import { supabase } from "@/lib/supabaseClient";
import { DataTable } from "../data-table";

export default function AllUsersTab({ setSelectedUser, setOpenModal }: { setSelectedUser: any, setOpenModal: any }) {

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
    
    return <DataTable columns={columns} data={users} />;
}