"use client"

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ColumnDef } from "@tanstack/react-table";
import type { VerificationRequest } from "../../../types";



export type ColumnActions = {

    onViewDetails: (
        request: VerificationRequest
    ) => void;

};



export const getColumns = ({
    onViewDetails
}: ColumnActions): ColumnDef<VerificationRequest>[] => [



        {
            accessorKey: "user",

            header: "Usuario",

            cell: ({ row }) => {

                const user = row.original.user;

                return (
                    <div>
                        <p className="font-medium">
                            {user.fullName}
                        </p>

                        <p className="text-xs text-gray-500">
                            {user.email}
                        </p>
                    </div>
                );

            }
        },



        {
            accessorKey: "status",

            header: "Estado",

            cell: ({ row }) => {

                const status =
                    row.original.status;


                return (

                    <Badge
                        variant="outline"
                        className="
                    bg-yellow-50 
                    text-yellow-700
                    dark:bg-yellow-950
                    dark:text-yellow-300
                    "
                    >

                        {status}

                    </Badge>

                );

            }

        },



        {
            accessorKey: "createdAt",

            header: "Fecha Solicitud",

            cell: ({ row }) => {


                return new Date(
                    row.original.createdAt
                )
                    .toLocaleString("es-ES");


            }

        },



        {
            id: "documents",

            header: "Documentos",

            cell: ({ row }) => {


                return (

                    <span className="text-sm">

                        {row.original.documents.length}
                        {" "}
                        archivos

                    </span>

                );

            }

        },



        {
            id: "actions",

            cell: ({ row }) => {


                const request =
                    row.original;



                return (

                    <Button

                        variant="outline"

                        size="sm"

                        onClick={() =>
                            onViewDetails(request)
                        }

                    >

                        Ver detalles

                    </Button>

                );

            }

        }

    ];