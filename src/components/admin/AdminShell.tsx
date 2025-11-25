"use client"

import { SidebarProvider } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/admin/app-sidebar"
import { Navbar } from "@/components/admin/Navbar"

export function AdminShell({ children }: { children: React.ReactNode }) {
    return (
        <SidebarProvider>
            <div className="flex min-h-screen w-full">
                <AppSidebar />
                <div className="flex flex-1 flex-col">
                    <Navbar />
                    <main className="flex-1 p-6 bg-muted/10 rounded-t-lg">
                        {children}
                    </main>
                </div>
            </div>
        </SidebarProvider>
    )
}
