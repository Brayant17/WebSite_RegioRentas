"use client";

import type { ColumnDef } from "@tanstack/react-table";
import type { Property } from "./types";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { IconDotsVertical } from "@tabler/icons-react";
import { StatusBadge } from "./StatusBadge";

// Colores por estado (ajusta según tus estados reales)
const statusColor: Record<Property["status"], string> = {
    published: "bg-green-100 text-green-700 border-green-300",
    draft: "bg-yellow-100 text-yellow-700 border-yellow-300",
    archived: "bg-gray-100 text-gray-700 border-gray-300",
};

export const columns: ColumnDef<Property>[] = [
    {
        accessorKey: "title",
        header: "Título",
        cell: ({ row }) => {
            const property = row.original;
            const initials = property.title.substring(0, 2).toUpperCase();

            return (
                <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                        <AvatarFallback>{initials}</AvatarFallback>
                    </Avatar>
                    <span className="font-medium">{property.title}</span>
                </div>
            );
        },
    },

    {
        accessorKey: "slug",
        header: "Enlace",
        cell: ({ row }) => (
            <span className="text-muted-foreground capitalize">
                <a href={`/propiedad/${row.original.slug}`} target="_blank">{row.original.slug}</a>
            </span>
        ),
    },

    {
        accessorKey: "property_type",
        header: "Tipo",
        cell: ({ row }) => (
            <span className="text-muted-foreground capitalize">
                {row.original.property_type}
            </span>
        ),
    },

    {
        accessorKey: "price",
        header: "Precio",
        cell: ({ row }) =>
            new Intl.NumberFormat("es-ES", {
                style: "currency",
                currency: "MXN",
            }).format(row.original.price),
    },

    {
        accessorKey: "status",
        header: "Estado",
        cell: ({ row }) => (
            <StatusBadge status={row.original.status as any} />
        ),
    },

    {
        accessorKey: "created_at",
        header: "Creado",
        cell: ({ row }) => {
            const date = new Date(row.original.created_at).toLocaleDateString();
            return <span className="text-muted-foreground">{date}</span>;
        },
    },

    {
        id: "actions",
        cell: ({ row }) => (
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                        <IconDotsVertical />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuItem>
                        <a href={`/panel/publicaciones/editar/${row.original.id}`}>Editar</a>
                    </DropdownMenuItem>
                    <DropdownMenuItem>Despublicar</DropdownMenuItem>
                    <DropdownMenuItem className="text-red-500">Eliminar</DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        ),
    },
];
