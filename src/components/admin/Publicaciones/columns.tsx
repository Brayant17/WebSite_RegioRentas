"use client";

import type { ColumnDef } from "@tanstack/react-table";
import type { Property } from "./types";
import { StatusBadge } from "./StatusBadge";
import DropDownActions from "./DropDownActions";

export const columns: ColumnDef<Property>[] = [
    {
        accessorKey: "title",
        header: "Título",
        cell: ({ row }) => (
            <div className="flex items-center gap-3">
                <span className="font-medium">{row.original.title}</span>
            </div>
        )
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
        accessorKey: "published_at",
        header: "Publicado",
        cell: ({ row }) => {
            const date = new Date(row.original.published_at).toLocaleDateString();
            return <span className="text-muted-foreground">{date}</span>;
        },
    },

    {
        id: "actions",
        cell: ({ row }) => {
            const propertyName = row.original.title;
            const idOwner = row.original.id_owner;
            return (
                <DropDownActions idProperty={row.original.id} propertyName={propertyName} idOwner={idOwner} />
            )
        },
    },
];
