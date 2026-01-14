import React, { useState, useEffect } from "react";
import {
    Building2,
    MapPin,
    Check,
    Loader2,
    X
} from "lucide-react";

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useEditProperty } from "@/modules/realEstateBI/ui/hooks/propiedades/useEditProperty";


interface EditPropertyDialogProps {
    property?: any; // Instancia de tu entidad Property
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSaved: () => void;
}

export default function EditPropertyDialog({
    property,
    open,
    onOpenChange,
    onSaved
}: EditPropertyDialogProps) {

    const { putProperty, loading, error, success } = useEditProperty();

    // Estado local del formulario
    const [formData, setFormData] = useState({
        name: "",
        address: "",
        city: "",
        state: "",
        postalCode: "",
        active: true
    });

    const [errors, setErrors] = useState<Record<string, string>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Sincronizar datos cuando se abre el dialog con una propiedad
    useEffect(() => {
        if (property && open) {
            setFormData({
                name: property.name ?? "",
                address: property.address ?? "",
                city: property.city ?? "",
                state: property.state ?? "",
                postalCode: property.postalCode ?? "",
                active: property.active ?? true
            });
            setErrors({});
        }
    }, [property, open]);


    const validate = () => {
        const newErrors: Record<string, string> = {};
        if (!formData.name.trim()) newErrors.name = "El nombre es obligatorio";
        if (!formData.address.trim()) newErrors.address = "La dirección es obligatoria";
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validate() || !property?.id) return;

        setIsSubmitting(true);

        try {
            await putProperty({
                id: property.id,
                name: formData.name,
                address: formData.address,
                city: formData.city,
                state: formData.state,
                postalCode: formData.postalCode,
                active: formData.active
            });
            onSaved()
            onOpenChange(false);
        } catch (error) {
            console.error("Error al guardar:", error);
        } finally {
            setIsSubmitting(false);
        }
    };


    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        // Limpiar error al escribir
        if (errors[name]) setErrors(prev => ({ ...prev, [name]: "" }));
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden border-none shadow-2xl">
                <form onSubmit={handleSubmit}>
                    {/* Header con estilo */}
                    <DialogHeader className="px-6 pt-6 pb-4 bg-slate-50 dark:bg-slate-900">
                        <div className="flex items-center gap-3">
                            <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                                <Building2 size={20} />
                            </div>
                            <div>
                                <DialogTitle className="text-lg font-bold">Editar Propiedad</DialogTitle>
                                <DialogDescription className="text-xs">
                                    ID: {property?.id || 'Nuevo'} — Actualiza los campos requeridos.
                                </DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>

                    <div className="p-6 space-y-5">
                        {/* Campo: Nombre */}
                        <div className="space-y-2">
                            <Label htmlFor="name" className="text-xs font-bold uppercase text-slate-500">Nombre del Edificio</Label>
                            <div className="relative">
                                <Building2 className="absolute left-3 top-2.5 size-4 text-slate-400" />
                                <Input
                                    id="name"
                                    name="name"
                                    value={formData.name}
                                    onChange={handleChange}
                                    className={`pl-9 ${errors.name ? "border-red-500 ring-red-100" : ""}`}
                                    placeholder="Ej. Torre Panorama"
                                />
                            </div>
                            {errors.name && <p className="text-[11px] text-red-500 font-medium">{errors.name}</p>}
                        </div>

                        {/* Campo: Dirección */}
                        <div className="space-y-2">
                            <Label htmlFor="address" className="text-xs font-bold uppercase text-slate-500">Dirección Física</Label>
                            <div className="relative">
                                <MapPin className="absolute left-3 top-2.5 size-4 text-slate-400" />
                                <Input
                                    id="address"
                                    name="address"
                                    value={formData.address}
                                    onChange={handleChange}
                                    className={`pl-9 ${errors.address ? "border-red-500 ring-red-100" : ""}`}
                                    placeholder="Av. Principal #123"
                                />
                            </div>
                            {errors.address && <p className="text-[11px] text-red-500 font-medium">{errors.address}</p>}
                        </div>

                        {/* Fila: Ciudad y Estado */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="city" className="text-xs font-bold uppercase text-slate-500">Ciudad</Label>
                                <Input id="city" name="city" value={formData.city} onChange={handleChange} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="state" className="text-xs font-bold uppercase text-slate-500">Estado</Label>
                                <Input id="state" name="state" value={formData.state} onChange={handleChange} />
                            </div>
                        </div>

                        {/* Fila: CP y Switch de Activo */}
                        <div className="grid grid-cols-2 gap-4 pt-2">
                            <div className="space-y-2">
                                <Label htmlFor="postalCode" className="text-xs font-bold uppercase text-slate-500">Código Postal</Label>
                                <Input id="postalCode" name="postalCode" value={formData.postalCode} onChange={handleChange} />
                            </div>

                            <div className="flex items-center justify-between rounded-xl border p-3 bg-slate-50/50">
                                <div className="space-y-0.5">
                                    <Label className="text-[10px] font-bold uppercase text-slate-500">Propiedad Activa</Label>
                                    <p className="text-[9px] text-slate-400 leading-none">Visibilidad en BI</p>
                                </div>
                                <Switch
                                    checked={formData.active}
                                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, active: checked }))}
                                />
                            </div>
                        </div>
                    </div>

                    <Separator />

                    {/* Footer con acciones */}
                    <DialogFooter className="px-6 py-4 bg-slate-50/30 dark:bg-slate-900/30 gap-2 sm:gap-0">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            disabled={isSubmitting}
                            className="rounded-lg mx-1"
                        >
                            Cancelar
                        </Button>
                        <Button
                            type="submit"
                            disabled={isSubmitting}
                            className="rounded-lg min-w-[120px] mx-1"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Guardando
                                </>
                            ) : (
                                <>
                                    <Check className="mr-2 h-4 w-4" />
                                    Actualizar
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}