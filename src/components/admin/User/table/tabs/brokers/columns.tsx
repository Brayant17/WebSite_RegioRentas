"use client"
// TODO: hacer que en action aparecza la opcion del modal o colocar boton para modal

import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import type { ColumnDef } from "@tanstack/react-table"
import { MoreHorizontal } from "lucide-react"


export type RequestPremium = {
    id: string,
    user_name: string,
    status: string,
    created_at: string,
}

export const columns: ColumnDef<RequestPremium>[] = [
    // {
    //     accessorKey: "id",
    //     header: "id"
    // },
    {
        accessorKey: "user_name",
        header: "Usuario"
    },
    {
        accessorKey: "status",
        header: "Estado"
    },
    {
        accessorKey: "created_at",
        header: "Fecha Solicitud",
        cell: ({ row }) => {
            const date = new Date(row.original.created_at)

            return date.toLocaleString("es-ES")
        }
    },
    {
        id: "actions",
        cell: ({ row }) => {
            const solicitud = row.original

            return (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Open menu</span>
                            <MoreHorizontal className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuItem
                            onClick={() => navigator.clipboard.writeText(solicitud.id)}
                        >
                            copiar solicitud id 
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem>View customer</DropdownMenuItem>
                        <DropdownMenuItem>View payment details</DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            )
        }
    }
]