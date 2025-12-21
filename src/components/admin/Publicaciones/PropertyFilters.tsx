"use client";

import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useState } from "react";

export function PropertyFilters({ onFilter, className }: { onFilter: any, className?: string }) {
    const [title, setTitle] = useState("");
    const [propertyType, setPropertyType] = useState("");
    const [status, setStatus] = useState("");
    const [slug, setSlug] = useState("");

    const clearFilters = () => {
        setTitle("");
        setPropertyType("");
        setStatus("");
        setSlug("");

        onFilter({
            title: "",
            property_type: "",
            status: "",
            slug: "",
        });
    };

    return (
        <div
            className={`flex flex-wrap items-center gap-3 rounded-lg ${className}`}
        >

            {/* Buscar por título */}
            <Input
                placeholder="Buscar por título..."
                value={title}
                onChange={(e) => {
                    setTitle(e.target.value);
                    onFilter({
                        title: e.target.value,
                        property_type: propertyType,
                        status,
                        slug
                    });
                }}
                className="w-52"
            />

            {/* Buscar por slug */}
            <Input
                placeholder="Buscar por enlace (slug)..."
                value={slug}
                onChange={(e) => {
                    setSlug(e.target.value);
                    onFilter({
                        title,
                        property_type: propertyType,
                        status,
                        slug: e.target.value
                    });
                }}
                className="w-52"
            />

            {/* Tipo de propiedad */}
            <Select
                value={propertyType}
                onValueChange={(value) => {
                    setPropertyType(value);
                    onFilter({
                        title,
                        property_type: value,
                        status,
                        slug
                    });
                }}
            >
                <SelectTrigger className="w-48">
                    <SelectValue placeholder="Tipo de propiedad" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="Casa">Casa</SelectItem>
                    <SelectItem value="Departamento">Departamento</SelectItem>
                    <SelectItem value="Terreno">Terreno</SelectItem>
                    <SelectItem value="Local">Comercial</SelectItem>
                </SelectContent>
            </Select>

            {/* Estado */}
            <Select
                value={status}
                onValueChange={(value) => {
                    setStatus(value);
                    onFilter({
                        title,
                        property_type: propertyType,
                        status: value,
                        slug
                    });
                }}
            >
                <SelectTrigger className="w-40">
                    <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="published">Publicado</SelectItem>
                    <SelectItem value="draft">Borrador</SelectItem>
                    <SelectItem value="archived">Archivado</SelectItem>
                </SelectContent>
            </Select>

            <Button variant="outline" onClick={clearFilters}>
                Limpiar filtros
            </Button>
        </div>
    );
}
