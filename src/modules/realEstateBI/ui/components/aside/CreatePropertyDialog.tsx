import { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { IconBuildings, IconMapPin, IconHash } from "@tabler/icons-react";
import { useCreateProperty } from "../../hooks/propiedades/useCreateProperty";

export function CreatePropertyDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (open: boolean) => void; onCreated?: () => void; }) {
    // Hook personalizado para crear propiedad
    const { createProperty, loading, error } = useCreateProperty();

    // Estado inicial del formulario
    const [formData, setFormData] = useState({
        name: "",
        address: "",
        city: "",
        state: "",
        postalCode: "",
    });

    // Manejador de cambios en los inputs
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { id, value } = e.target;
        setFormData((prev) => ({
            ...prev,
            [id]: value,
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Aquí puedes realizar la validación manual antes de crear la entidad
        if (!formData.name || !formData.address) {
            alert("Por favor, completa los campos obligatorios.");
            return;
        }

        // Llamar al hook para crear la propiedad
        await createProperty(formData);
        // ver manera de actualizar la lista de propiedades después de crear una nueva
        if (onCreated) {
            onCreated();
        }

        // Reset y cerrar
        setFormData({ name: "", address: "", city: "", state: "", postalCode: "" });
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-primary/10 rounded-lg text-primary">
                            <IconBuildings size={22} />
                        </div>
                        <DialogTitle className="text-xl">Nueva Propiedad</DialogTitle>
                    </div>
                    <DialogDescription>
                        Ingresa los datos para registrar un edificio en tu portafolio.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-5 py-4">
                    {/* Nombre */}
                    <div className="grid gap-2">
                        <Label htmlFor="name" className="text-sm font-medium">
                            Nombre del Edificio <span className="text-destructive">*</span>
                        </Label>
                        <div className="relative">
                            <IconBuildings className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                id="name"
                                value={formData.name}
                                onChange={handleChange}
                                placeholder="Ej. Residencial Las Lomas"
                                className="pl-9"
                                required
                            />
                        </div>
                    </div>

                    {/* Dirección */}
                    <div className="grid gap-2">
                        <Label htmlFor="address" className="text-sm font-medium">
                            Dirección <span className="text-destructive">*</span>
                        </Label>
                        <div className="relative">
                            <IconMapPin className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                id="address"
                                value={formData.address}
                                onChange={handleChange}
                                placeholder="Calle y número"
                                className="pl-9"
                                required
                            />
                        </div>
                    </div>

                    {/* Ciudad y Estado */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="city">Ciudad</Label>
                            <Input
                                id="city"
                                value={formData.city}
                                onChange={handleChange}
                                placeholder="Monterrey"
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="state">Estado</Label>
                            <Input
                                id="state"
                                value={formData.state}
                                onChange={handleChange}
                                placeholder="N.L."
                            />
                        </div>
                    </div>

                    {/* Código Postal */}
                    <div className="grid gap-2">
                        <Label htmlFor="postalCode">Código Postal</Label>
                        <div className="relative">
                            <IconHash className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                id="postalCode"
                                value={formData.postalCode}
                                onChange={handleChange}
                                placeholder="64000"
                                className="pl-9"
                            />
                        </div>
                    </div>

                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={() => onOpenChange(false)}
                        >
                            Cancelar
                        </Button>
                        <Button type="submit" className="font-semibold">
                            Guardar Propiedad
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}