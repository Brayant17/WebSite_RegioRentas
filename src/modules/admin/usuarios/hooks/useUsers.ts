import { useEffect, useState } from "react"
import { fetchUsers } from "../services/users.service.ts"
import type { User } from "../types"
import type { UserFilters } from "../types"

export function useUsers() {

    // UI state
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Table state
    const [page, setPage] = useState(1)
    const [rowsPerPage, setRowsPerPage] = useState(10)
    const [filters, setFilters] = useState<UserFilters>({ email: "", role: "", account_type: "", is_verified: "" })
    const [totalPages, setTotalPages] = useState(1)

    const limit = rowsPerPage; // registros por página

    // Data state
    const [users, setUsers] = useState<User[]>([])

    // Garbage
    // const [openModal, setOpenModalState] = useState<null | "details" | "edit" | "delete" | "suspend">(null)
    // const [selectedUser, setSelectedUser] = useState<User | null>(null)


    useEffect(() => {
        loadUsers()
    }, [filters, page, rowsPerPage])

    async function loadUsers() {
        setLoading(true)

        try {
            const { data, count } = await fetchUsers(filters, page, limit)
            setUsers(data)
            setTotalPages(Math.ceil(count / limit))
        } catch (err) {
            setError("Error al cargar usuarios")
            console.error("Error al cargar usuarios:", err)
        } finally {
            setLoading(false)
        }
    }

    // Funciones que al parecer no van aqui
    // function openModalForUser(user: User, action: "details" | "edit" | "delete" | "suspend") {
    //     setSelectedUser(user)
    //     setOpenModalState(action)
    // }

    // function closeModal() {
    //     setSelectedUser(null)
    //     setOpenModalState(null)
    // }

    return {
        users,
        loading,
        error,
        filters,
        setFilters,
        page,
        setPage,
        totalPages,
        rowsPerPage,
        setRowsPerPage,
        loadUsers
    }
}