"use client";

import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useState } from "react";

export function UserFilters({ onFilter, className }: { onFilter: any, className?: string }) {
    const [email, setEmail] = useState("");
    const [role, setRole] = useState("");
    const [status, setStatus] = useState("");

    const clearFilters = () => {
        setEmail("");
        setRole("");
        setStatus("");
        onFilter({ email: "", role: "", status: "" });
    };

    return (
        <div
            className={`
                flex flex-wrap items-center gap-3 mb-4 p-4 
                bg-white dark:bg-neutral-900
                border border-gray-200 dark:border-neutral-700
                rounded-lg shadow-sm
                ${className}
            `}
        >
            {/* Email Search */}
            <Input
                placeholder="Buscar por email..."
                value={email}
                onChange={(e) => {
                    setEmail(e.target.value);
                    onFilter({ email: e.target.value, role, status });
                }}
                className="w-52"
            />

            {/* Role */}
            <Select
                value={role}
                onValueChange={(value) => {
                    setRole(value);
                    onFilter({ email, role: value, status });
                }}
            >
                <SelectTrigger className="w-40">
                    <SelectValue placeholder="Rol" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="user">User</SelectItem>
                </SelectContent>
            </Select>

            {/* Status */}
            <Select
                value={status}
                onValueChange={(value) => {
                    setStatus(value);
                    onFilter({ email, role, status: value });
                }}
            >
                <SelectTrigger className="w-40">
                    <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="approved">Aprobado</SelectItem>
                    <SelectItem value="pending">Pendiente</SelectItem>
                    <SelectItem value="rejected">Rechazado</SelectItem>
                </SelectContent>
            </Select>

            <Button variant="outline" onClick={clearFilters}>
                Limpiar filtros
            </Button>
        </div>
    );
}
