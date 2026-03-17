// AllUsersTab.tsx
import type { User, UserFilters as filters } from "../../../types";
import { useState } from "react";
import { UserDetailsModal } from "./UserDetailsModal";
import { UserFilters } from "@/modules/admin/usuarios/components/tabs/user-table/UserFilters";
import { CSVExportButton } from "@/components/CSVExportButton";
import { DataTable } from "@/components/ui/DataTable/data-table";
import { getColumns } from "./column";
import { useUsers } from "../../../hooks/useUsers";

export default function AllUsersTab() {
    const { users, page, setPage, rowsPerPage, setRowsPerPage, totalPages, loading, error, filters, setFilters, loadUsers } = useUsers()
    const [openModal, setOpenModalState] = useState<null | "details" | "edit" | "delete" | "suspend">(null)
    const [selectedUser, setSelectedUser] = useState<User | null>(null)

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
                    onFilter={(f: filters) => {
                        setPage(1);
                        setFilters(f);
                    }}
                    className="w-full md:w-auto"
                />
                <CSVExportButton fileName="all-Users" data={users} className="w-full md:w-auto" />
            </div>
            <DataTable
                columns={columns}
                data={users}
                page={page}
                setPage={setPage}
                rowsPerPage={rowsPerPage}
                setRowsPerPage={setRowsPerPage}
                totalPages={totalPages}
             />
        </div>
    );
}