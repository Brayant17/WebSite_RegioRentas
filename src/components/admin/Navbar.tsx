"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useSidebar } from "@/components/ui/sidebar"
import { IconMenu2, IconSun, IconMoon, IconSearch } from "@tabler/icons-react"

export function Navbar() {
    const { toggleSidebar } = useSidebar()
    const [darkMode, setDarkMode] = React.useState(false)

    React.useEffect(() => {
        document.documentElement.classList.toggle("dark", darkMode)
    }, [darkMode])

    return (
        <header className="flex items-center justify-between px-4 py-2 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            {/* Botón de menú (sidebar) */}
            <div className="flex items-center gap-2">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={toggleSidebar}
                    className="sm:hidden"
                >
                    <IconMenu2 className="h-5 w-5" />
                </Button>
                <h1 className="text-lg font-semibold">Admin Panel</h1>
            </div>

            {/* Buscador */}
            <div className="hidden sm:flex items-center relative w-full max-w-xs">
                <IconSearch className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input type="text" placeholder="Buscar..." className="pl-9" />
            </div>

            {/* Acciones */}
            <div className="flex items-center gap-2">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setDarkMode(!darkMode)}
                >
                    {darkMode ? (
                        <IconSun className="h-5 w-5" />
                    ) : (
                        <IconMoon className="h-5 w-5" />
                    )}
                </Button>

                <div className="relative">
                    <button className="flex items-center justify-center w-9 h-9 rounded-full bg-muted hover:bg-muted/70 text-sm font-medium">
                        <span>M</span>
                    </button>
                </div>
            </div>
        </header>
    )
}
