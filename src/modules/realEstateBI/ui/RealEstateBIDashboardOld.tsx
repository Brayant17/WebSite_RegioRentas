import React, { useEffect, useState } from "react";
import { Plus, Loader2, MapPin, Building } from "lucide-react";

// Importaciones de componentes UI de Shadcn
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge"; // Opcional, para estados

// Importación del hook personalizado
import { useCreateProperty } from "./hooks/propiedades/useCreateProperty";
import { useGetProperties } from "./hooks/propiedades/useGetProperties";

export default function RealEstateBIDashboard() {
    // Hook personalizado
    const { createProperty, loading, error } = useCreateProperty();
    const { properties = [], fetchProperties, loading: loadingProperties, error: errorProperties } = useGetProperties();

    useEffect(() => {
        fetchProperties();
    }, []);

    // Estado para controlar la apertura del Modal
    const [open, setOpen] = useState(false);

    console.log("Properties from hook:", properties);
    // Estado del formulario
    const [formData, setFormData] = useState({
        name: "",
        address: "",
        city: "",
        state: "",
        postalCode: "",
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Llamada a tu hook de creación
        await createProperty(formData);
        await fetchProperties();
        // Limpiar y cerrar
        setFormData({ name: "", address: "", city: "", state: "", postalCode: "" });
        setOpen(false);
    };

    return (
        <div className="p-8 space-y-6 bg-slate-50 min-h-full">

            {/* Encabezado del Dashboard */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900">Propiedades</h1>
                    <p className="text-slate-500">Gestiona y visualiza tu portafolio inmobiliario.</p>
                </div>

                {/* COMPONENTE MODAL (DIALOG) */}
                <Dialog open={open} onOpenChange={setOpen}>
                    <DialogTrigger asChild>
                        <Button className="bg-blue-600 hover:bg-blue-700">
                            <Plus className="mr-2 h-4 w-4" /> Nueva Propiedad
                        </Button>
                    </DialogTrigger>

                    <DialogContent className="sm:max-w-[500px]">
                        <DialogHeader>
                            <DialogTitle>Alta de Propiedad</DialogTitle>
                            <DialogDescription>
                                Llena los datos requeridos para registrar una nueva propiedad en el sistema.
                            </DialogDescription>
                        </DialogHeader>

                        <form onSubmit={handleSubmit} className="grid gap-4 py-4">
                            <div className="grid gap-2">
                                <Label htmlFor="name">Nombre</Label>
                                <Input
                                    id="name"
                                    name="name"
                                    placeholder="Ej. Torre Mayor"
                                    value={formData.name}
                                    onChange={handleChange}
                                    required
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="address">Dirección</Label>
                                <Input
                                    id="address"
                                    name="address"
                                    placeholder="Calle y número"
                                    value={formData.address}
                                    onChange={handleChange}
                                    required
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="city">Ciudad</Label>
                                    <Input
                                        id="city"
                                        name="city"
                                        value={formData.city}
                                        onChange={handleChange}
                                        required
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="state">Estado</Label>
                                    <Input
                                        id="state"
                                        name="state"
                                        value={formData.state}
                                        onChange={handleChange}
                                        required
                                    />
                                </div>
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="postalCode">Código Postal</Label>
                                <Input
                                    id="postalCode"
                                    name="postalCode"
                                    value={formData.postalCode}
                                    onChange={handleChange}
                                    className="w-1/2"
                                />
                            </div>

                            {error && (
                                <div className="text-sm text-red-500 bg-red-50 p-2 rounded">
                                    Error: {JSON.stringify(error)}
                                </div>
                            )}

                            <DialogFooter>
                                <Button type="submit" disabled={loading}>
                                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    {loading ? "Guardando..." : "Guardar Propiedad"}
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            {/* TABLA DE PROPIEDADES */}
            <div className="rounded-md border bg-white shadow-sm">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[250px]">Propiedad</TableHead>
                            <TableHead>Ubicación</TableHead>
                            <TableHead>Ciudad</TableHead>
                            <TableHead>Estado</TableHead>
                            <TableHead>Código Postal</TableHead>
                            <TableHead className="text-right">Estatus</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {properties.map((property) => (
                            <TableRow key={property.id}>
                                <TableCell className="font-medium">
                                    <div className="flex items-center">
                                        <Building className="mr-2 h-4 w-4 text-slate-400" />
                                        {property.name}
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <div className="flex items-center text-slate-500">
                                        <MapPin className="mr-1 h-3 w-3" />
                                        {property.address}
                                    </div>
                                </TableCell>
                                <TableCell>{property.city}</TableCell>
                                <TableCell>{property.state}</TableCell>
                                <TableCell>{property.postalCode}</TableCell>
                                <TableCell className="text-right">
                                    {property.active}
                                    <Badge variant={property.active === true ? "default" : "secondary"}>
                                        {property.active ? "Activo" : "Inactivo"}
                                    </Badge>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}