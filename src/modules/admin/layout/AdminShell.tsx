"use client"

import { SidebarProvider } from "@/components/ui/sidebar"
import { AppSidebar } from "@/modules/admin/layout/app-sidebar"
import { SiteHeader } from "./site-header";
import { useCurrentUser } from "../hooks/useCurrentUser";

export function AdminShell({ title, children }: { title:string, children: React.ReactNode }) {

    const { user } = useCurrentUser()

    return (
        <SidebarProvider>
            <AppSidebar user={user} />
            <div className="flex flex-col w-full min-h-screen ">
                <div className="@container/main flex flex-1 flex-col gap-2">
                    <SiteHeader title={title} />
                    {children}
                </div>
            </div>
        </SidebarProvider>
    )
}
