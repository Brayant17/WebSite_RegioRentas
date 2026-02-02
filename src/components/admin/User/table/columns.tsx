"use client"

import type { ColumnDef } from "@tanstack/react-table"
import type { User } from "../types"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { IconDotsVertical } from "@tabler/icons-react"
import { StatusBadge } from "./StatusBadge"

type ColumnsActions = {
    onEdit: (user: User) => void
    onViewDetails: (user: User) => void
    onSuspend: (user: User) => void
    onDelete: (user: User) => void
}

export const getColumns = ({
    onEdit,
    onViewDetails,
    onSuspend,
    onDelete,
}: ColumnsActions): ColumnDef<User>[] => [
        {
            accessorKey: "email",
            header: "Usuario",
            cell: ({ row }) => {
                const user = row.original
                const initials = user.email.substring(0, 2).toUpperCase()

                return (
                    <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                            <AvatarFallback>{initials}</AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{user.email}</span>
                    </div>
                )
            },
        },
        {
            accessorKey: "full_name",
            header: "Full Name",
        },
        {
            accessorKey: "role",
            header: "Rol",
            cell: ({ row }) => (
                <span className="text-muted-foreground">
                    {row.original.role}
                </span>
            ),
        },
        {
            accessorKey: "whatsapp",
            header: "Whatsapp",
        },
        {
            accessorKey: "approval_status",
            header: "Broker",
            cell: ({ row }) => (
                <StatusBadge status={row.original.approval_status} />
            ),
        },
        {
            accessorKey: "created_at",
            header: "Creado",
            cell: ({ row }) => {
                const date = new Date(
                    row.original.created_at
                ).toLocaleDateString()

                return (
                    <span className="text-muted-foreground">
                        {date}
                    </span>
                )
            },
        },
        {
            id: "actions",
            cell: ({ row }) => {
                const user = row.original

                return (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                            >
                                <IconDotsVertical />
                            </Button>
                        </DropdownMenuTrigger>

                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => onEdit(user)}>
                                Editar
                            </DropdownMenuItem>

                            <DropdownMenuItem
                                onClick={() => onViewDetails(user)}
                            >
                                Ver detalles
                            </DropdownMenuItem>

                            <DropdownMenuItem
                                onClick={() => onSuspend(user)}
                            >
                                Suspender
                            </DropdownMenuItem>

                            <DropdownMenuItem
                                className="text-red-500"
                                onClick={() => onDelete(user)}
                            >
                                Eliminar
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                )
            },
        },
    ]
