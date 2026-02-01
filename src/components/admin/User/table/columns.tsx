"use client";

import type { ColumnDef } from "@tanstack/react-table";
import type { User } from "../types";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { IconDotsVertical } from "@tabler/icons-react";
import { StatusBadge } from "./StatusBadge";

// Map de estilos
const statusColor: Record<User["approval_status"], string> = {
    approved: "bg-green-100 text-green-700 border-green-300",
    pending: "bg-yellow-100 text-yellow-700 border-yellow-300",
    rejected: "bg-red-100 text-red-700 border-red-300",
};

export const columns: ColumnDef<User>[] = [
    {
        accessorKey: "email",
        header: "Usuario",
        cell: ({ row }) => {
            const user = row.original;
            const initials = user.email.substring(0, 2).toUpperCase();

            return (
                <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                        <AvatarFallback>{initials}</AvatarFallback>
                    </Avatar>
                    <span className="font-medium">{user.email}</span>
                </div>
            );
        },
    },
    {
        accessorKey: "full_name",
        header: "Full Name",
    },
    {
        accessorKey: "role",
        header: "Rol",
        cell: ({ row }) => <span className="text-muted-foreground">{row.original.role}</span>,
    },

    {
        accessorKey: "whatsapp",
        header: "Whatsapp",
    },

    {
        accessorKey: "approval_status",
        header: "Broker",
        cell: ({ row }) => {
            return <StatusBadge status={row.original.approval_status as any} />;
        },
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
                    <DropdownMenuItem>Editar</DropdownMenuItem>
                    <DropdownMenuItem>Ver detalles</DropdownMenuItem>
                    <DropdownMenuItem>Suspender</DropdownMenuItem>
                    <DropdownMenuItem className="text-red-500">Eliminar</DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        ),
    },
];
