"use client"
import { Badge } from "@/components/ui/badge"
// TODO: hacer que en action aparecza la opcion del modal o colocar boton para modal

import { Button } from "@/components/ui/button"
import type { ColumnDef } from "@tanstack/react-table"


export type RequestPremium = {
    id: string,
    user_name: string,
    status: string,
    created_at: string,
}

export type ColumnActions = {
    onViewDetails: (request: RequestPremium) => void
}

export const getColumns = ({ onViewDetails }: ColumnActions): ColumnDef<RequestPremium>[] => [
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
        header: "Estado",
        cell: ({ row }) => {
            const status = row.original.status

            return (
                <Badge variant="outline" className="bg-yellow-50 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300">
                    {status}
                </Badge>
            )
        }
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
                <Button variant="outline" size="sm" onClick={() => onViewDetails(solicitud)}>
                    Ver detalles
                </Button>
            )
        }
    }
]