import React, { useState, useEffect } from 'react';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea"; // Asumiendo que tienes este componente de shadcn
import { useCreateUnit } from '../../../hooks/unidades/useCreateUnit';
import type { CreateUnitInput } from '@/modules/realEstateBI/application/dtos/CreateUnitInput';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { UnitType } from '@/modules/realEstateBI/domain/entities/Unit';
import { toast } from 'sonner';

interface UnitCreateProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    propertyID: string;
}

export default function UnitCreateDialog({ open, onOpenChange, propertyID }: UnitCreateProps) {
    const { createUnit, loading } = useCreateUnit();

    const initialState: CreateUnitInput = {
        propertyId: propertyID,
        code: "",
        name: "",
        type: "DEPARTAMENTO",
        floor: null,
        areaM2: null,
        bedrooms: null,
        bathrooms: null,
        parkingSpots: null,
        rentPrice: 0,
        currency: "MXN",
        furnished: false,
        description: ""
    };

    const [formData, setFormData] = useState<CreateUnitInput>(initialState);

    useEffect(() => {
        if (open) {
            setFormData(prev => ({ ...prev, propertyId: propertyID }));
        }
    }, [propertyID, open]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;

        setFormData(prev => ({
            ...prev,
            [name]: type === 'number'
                ? (value === "" ? null : Number(value))
                : value
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        try {
            await createUnit(formData);
            onOpenChange(false);
            setFormData(initialState); // Limpiar formulario tras éxito
            toast.success("Unidad creada con exito");
        } catch (error) {
            toast.error("Ha ocurrido un error al crear la unidad");
        }
        finally {
            onOpenChange(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px] max-h-[95vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Nueva Unidad</DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="grid gap-6 py-4">
                    {/* Sección Básica */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="name">Nombre de la Unidad</Label>
                            <Input id="name" name="name" value={formData.name} onChange={handleChange} required placeholder="Ej: Suite 101" />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="code">Código Interno</Label>
                            <Input id="code" name="code" value={formData.code} onChange={handleChange} required placeholder="UNI-101" />
                        </div>
                    </div>

                    {/* Tipo y Precio */}
                    <div className="grid grid-cols-3 gap-4">
                        <div className="grid gap-2 col-span-1">
                            <Label htmlFor="type">Tipo</Label>

                            <Select
                                value={formData.type}
                                onValueChange={(value) =>
                                    setFormData((prev) => ({
                                        ...prev,
                                        type: value as UnitType,
                                    }))
                                }
                            >
                                <SelectTrigger id="type" className='w-full'>
                                    <SelectValue placeholder="Selecciona un tipo" />
                                </SelectTrigger>

                                <SelectContent>
                                    <SelectGroup>
                                        <SelectItem value="DEPARTAMENTO">Departamento</SelectItem>
                                        <SelectItem value="CASA">Casa</SelectItem>
                                        <SelectItem value="OFICINA">Oficina</SelectItem>
                                        <SelectItem value="LOCAL_COMERCIAL">Local comercial</SelectItem>
                                        <SelectItem value="BODEGA">Bodega</SelectItem>
                                        <SelectItem value="ESTACIONAMIENTO">Estacionamiento</SelectItem>
                                    </SelectGroup>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="grid gap-2 col-span-1">
                            <Label htmlFor="rentPrice">Precio Renta</Label>
                            <Input id="rentPrice" name="rentPrice" type="number" value={formData.rentPrice} onChange={handleChange} required />
                        </div>
                        <div className="grid gap-2 col-span-1">
                            <Label htmlFor="currency">Moneda</Label>
                            <Input id="currency" name="currency" value={formData.currency} onChange={handleChange} required />
                        </div>
                    </div>

                    {/* Detalles Físicos */}
                    <div className="grid grid-cols-4 gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="floor">Piso</Label>
                            <Input id="floor" name="floor" type="number" value={formData.floor ?? ""} onChange={handleChange} />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="areaM2">Área (m²)</Label>
                            <Input id="areaM2" name="areaM2" type="number" value={formData.areaM2 ?? ""} onChange={handleChange} />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="bedrooms">Hab.</Label>
                            <Input id="bedrooms" name="bedrooms" type="number" value={formData.bedrooms ?? ""} onChange={handleChange} />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="bathrooms">Baños</Label>
                            <Input id="bathrooms" name="bathrooms" type="number" value={formData.bathrooms ?? ""} onChange={handleChange} />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="parkingSpots">Estacionamientos</Label>
                            <Input id="parkingSpots" name="parkingSpots" type="number" value={formData.parkingSpots ?? ""} onChange={handleChange} />
                        </div>
                        <div className="flex items-center space-x-2 mt-auto pb-3">
                            <Checkbox
                                id="furnished"
                                checked={formData.furnished}
                                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, furnished: !!checked }))}
                            />
                            <Label htmlFor="furnished" className="text-sm font-medium leading-none cursor-pointer">
                                ¿Está amueblado?
                            </Label>
                        </div>
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="description">Descripción</Label>
                        <Textarea
                            id="description"
                            name="description"
                            placeholder="Detalles adicionales de la unidad..."
                            value={formData.description ?? ""}
                            onChange={handleChange}
                        />
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={loading}>
                            {loading ? "Creando..." : "Crear Unidad"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}