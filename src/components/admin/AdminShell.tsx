"use client"

import { SidebarProvider } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/admin/app-sidebar"
import { Navbar } from "@/components/admin/Navbar"
import { Toaster } from "sonner";

export function AdminShell({ children }: { children: React.ReactNode }) {
    return (
        <SidebarProvider>
            <AppSidebar />
            <div className="flex flex-col w-full min-h-screen ">
                <div className="@container/main flex flex-1 flex-col">
                    <Navbar />
                    {children}
                    {/* sonner */}
                    <Toaster />
                </div>
            </div>
        </SidebarProvider>
    )
}
