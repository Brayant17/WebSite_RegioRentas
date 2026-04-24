"use client"

import type { ColumnDef } from "@tanstack/react-table"
import type { User } from "../../../types"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { IconDotsVertical, IconLoader } from "@tabler/icons-react"
import { Badge } from "@/components/ui/badge"
import { BadgeCheck, Circle, Gem } from "lucide-react"

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
            accessorKey: "full_name",
            header: "Nombre",
            cell: ({ row }) => {
                const nombre = row.getValue<string>("full_name")
                const initials = nombre.substring(0, 2).toUpperCase()

                return (
                    <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                            <AvatarFallback>{initials}</AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{nombre}</span>
                    </div>
                )
            },
        },
        {
            accessorKey: "email",
            header: "email",
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
            cell: ({ row }) => (
                <span className="text-muted-foreground">
                    {row.original.whatsapp || "-"}
                </span>
            ),
        },
        {
            accessorKey: "account_type",
            header: "Tipo de cuenta",
            cell: ({ row }) => {
                const type = (row.getValue("account_type") as string).toUpperCase()

                const isPremium = type === "PREMIUM"

                const Icon = isPremium ? Gem : Circle
                const label = isPremium ? "Premium" : "Basic"

                return (
                    <Badge
                        variant="outline"
                        className={isPremium ? "text-purple-600 border-purple-300" : "text-gray-600"}
                    >
                        <Icon data-icon="inline-start" />
                        <span>{label}</span>
                    </Badge>
                )
            },
        },
        {
            accessorKey: "is_verified",
            header: "Verificación",
            cell: ({ row }) => {
                const isVerified = row.getValue<boolean>("is_verified")

                const Icon = isVerified ? BadgeCheck : IconLoader
                const label = isVerified ? "Verificado" : "No verificado"

                return (
                    <Badge
                        variant="outline"
                        className={isVerified ? "text-green-600 border-green-300" : "text-gray-600"}
                    >
                        <Icon data-icon="inline-start" />
                        <span>{label}</span>
                    </Badge>
                )
            }
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
                            <DropdownMenuItem
                                disabled={true}
                                onClick={() => onEdit(user)}>
                                Editar
                            </DropdownMenuItem>

                            <DropdownMenuItem
                                onClick={() => onViewDetails(user)}
                            >
                                Ver detalles
                            </DropdownMenuItem>

                            <DropdownMenuItem
                                disabled={true}
                                onClick={() => onSuspend(user)}
                            >
                                Suspender
                            </DropdownMenuItem>

                            <DropdownMenuItem
                                disabled={true}
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
