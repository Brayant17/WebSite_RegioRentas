"use client";

import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import type { UserFilters } from "../../../types";

export function UserFilters({ onFilter, className }: { onFilter: (filters: UserFilters) => void, className?: string }) {
    const [email, setEmail] = useState("");
    const [role, setRole] = useState("");
    const [isVerified, setIsVerified] = useState("");
    const [accountType, setAccountType] = useState("");

    const filters: UserFilters = { email, role, is_verified: isVerified, account_type: accountType };

    const handleFilterChange = (field: keyof UserFilters, value: string) => {
        const newFilters = { ...filters, [field]: value };
        onFilter(newFilters);
    }

    const clearFilters = () => {
        setEmail("");
        setRole("");
        setIsVerified("");
        setAccountType("");
        onFilter({ email: "", role: "", is_verified: "", account_type: "" });
    };

    return (
        <div
            className={`
                flex flex-wrap items-center gap-3 
                ${className}
            `}
        >
            {/* Email Search */}
            <Input
                placeholder="Buscar por email..."
                value={email}
                onChange={(e) => {
                    setEmail(e.target.value);
                    handleFilterChange("email", e.target.value);
                }}
                className="w-64"
            />

            {/* Role */}
            <Select
                value={role}
                onValueChange={(value) => {
                    setRole(value);
                    handleFilterChange("role", value);
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

            {/* account_tpye */}
                <Select
                value={accountType}
                onValueChange={(value) => {
                    setAccountType(value);
                    handleFilterChange("account_type", value);
                }}
            >
                <SelectTrigger className="w-40">
                    <SelectValue placeholder="Tipo de cuenta" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="basic">Basic</SelectItem>
                    <SelectItem value="premium">Premium</SelectItem>
                </SelectContent>
            </Select>

            {/* Status */}
            <Select
                value={isVerified}
                onValueChange={(value) => {
                    setIsVerified(value);
                    handleFilterChange("is_verified", value);
                }}
            >
                <SelectTrigger className="w-40">
                    <SelectValue placeholder="Verificación" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="true">Verificado</SelectItem>
                    <SelectItem value="false">No verificado</SelectItem>
                </SelectContent>
            </Select>

            <Button variant="outline" onClick={clearFilters}>
                Limpiar filtros
            </Button>
        </div>
    );
}
