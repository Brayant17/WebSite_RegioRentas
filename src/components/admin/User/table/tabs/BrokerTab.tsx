import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { DataTable } from "../data-table";
import type { User } from "../../types";
import type { ColumnDef } from "@tanstack/react-table";
import { Avatar, AvatarFallback } from "@radix-ui/react-avatar";
import { StatusBadge } from "../StatusBadge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";

type columnActions = {
    onViewDetails: (user: User) => void
}

export default function BrokerTab({ setSelectedUser, setOpenModal }: { setSelectedUser: any, setOpenModal: any }) {
    const [users, setUsers] = useState<any[]>([]);

    useEffect(() => {
        loadUsers();
    }, []);

    async function loadUsers() {
        const { data, error } = await supabase
            .rpc("get_latest_pending_requests")

        if (error) {
            console.error(error)
            return
        }

        setUsers(data)

        console.log(data)
    }

    return (
        <>
            <h1>usuarios con solisictud de broker</h1>
            <Alert className=" border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-50">
                <AlertTriangle />
                <AlertTitle>
                    Your subscription will expire in 3 days.
                </AlertTitle>
                <AlertDescription>
                    Renew now to avoid service interruption or upgrade to a paid plan to
                    continue using the service.
                </AlertDescription>
            </Alert>
            {
                users.map(user => (
                    <span>{user.id}</span>
                ))
            }
        </>

    )
}