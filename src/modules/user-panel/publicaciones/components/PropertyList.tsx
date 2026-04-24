// PropertyList.tsx
import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useProperty } from "../hooks/useProperty";

type PropertyToDelete = {
    id: string;
    title: string;
}

export default function PropertyList() {

    const { properties, fetchUserProperties, page, setPage, perPage, setPerPage, totalProperties } = useProperty();
    const [deleting, setDeleting] = useState(false); // Estado para indicar que se está eliminando
    // 🆕 Estado para el modal
    const [propertyToDelete, setPropertyToDelete] = useState<PropertyToDelete | null>(null);

    // Confirmar eliminación (llamada real)
    const handleClickDelete = async (idProperty: string) => {

        if (!propertyToDelete) return; // Seguridad extra

        setDeleting(true);

        const { error } = await supabase.functions.invoke("deletePropertyWithImages", {
            body: { idProperty: idProperty }
        });

        setDeleting(false);

        if (error) {
            toast.error("Error al eliminar la propiedad. Intenta nuevamente.");
        } else {
            toast.success("Propiedad eliminada exitosamente.");
            setPropertyToDelete(null); // Cerrar modal
            fetchUserProperties(); // Refrescar lista después de eliminar
        }

    };

    const totalPages = Math.max(1, Math.ceil(totalProperties / perPage));

    return (
        <div className="w-full relative">

            {properties.length === 0 ? (
                <p className="text-center py-8 text-slate-500">No hay propiedades disponibles.</p>
            ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {properties.map((property) => (
                        <div
                            key={property.id}
                            className="border border-slate-200 rounded-lg bg-white shadow-sm hover:shadow-md transition-shadow duration-200 overflow-hidden flex flex-col"
                        >
                            {/* Imagen */}
                            <div className="relative w-full h-48 bg-slate-100 flex items-center justify-center">
                                {property.property_images && property.property_images.length > 0 ? (
                                    <img
                                        src={property.property_images[0].url}
                                        alt={property.title}
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <span className="text-slate-400 text-sm">Sin imagen</span>
                                )}
                                <div className="absolute top-2 right-2 bg-slate-900 text-white text-xs font-medium px-2 py-1 rounded">
                                    ${property.price}
                                </div>
                            </div>

                            {/* Contenido */}
                            <div className="p-4 flex flex-col flex-grow">
                                <div className="flex justify-between items-start mb-2">
                                    <h3 className="font-semibold text-slate-800 text-base line-clamp-2">
                                        {property.title}
                                    </h3>
                                    <span className="text-slate-500 text-xs shrink-0">
                                        {property.property_type}
                                    </span>
                                </div>

                                <div className="text-sm text-slate-600 mb-3 flex-grow">
                                    <p>
                                        <span className="font-medium">Slug:</span>{" "}
                                        <a
                                            href={`/propiedad/${property.slug}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-blue-600 hover:underline break-all"
                                        >
                                            {property.slug}
                                        </a>
                                    </p>
                                </div>

                                {/* Acciones */}
                                <div className="w-full flex gap-3 justify-between mt-auto pt-2 border-t border-slate-100">
                                    <a
                                        href={`publicaciones/editar/${property.id}`}
                                        className="flex-1 text-center text-white bg-neutral-800 hover:bg-neutral-900 transition-colors text-sm font-medium py-1.5 rounded"
                                    >
                                        Editar
                                    </a>
                                    <button
                                        disabled={deleting} // Deshabilitar mientras se elimina
                                        onClick={() => setPropertyToDelete({ id: property.id, title: property.title })} // 🆕 Abrir modal
                                        className="flex-1 text-center text-red-600 border border-red-500 hover:bg-red-50 transition-colors text-sm font-medium py-1.5 rounded cursor-pointer"
                                    >
                                        Eliminar
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* 📄 Paginación */}
            <div className="flex flex-col sm:flex-row justify-between items-center gap-3 mt-6 border-t border-slate-200 pt-4 bg-[#fafafa] p-3 rounded-b-lg">
                <div className="flex gap-1 items-center text-sm">
                    <span>Mostrar por página:</span>
                    <select
                        value={perPage}
                        onChange={(e) => setPerPage(Number(e.target.value))}
                        className="border border-slate-300 px-1 py-0.5 rounded"
                    >
                        {[8, 12, 20, 52].map((size) => (
                            <option key={size} value={size}>
                                {size}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="flex items-center gap-1">
                    <button
                        disabled={page === 1}
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        className="border border-slate-400 rounded px-2 py-1 text-xs text-slate-600 bg-white disabled:opacity-50"
                    >
                        {"<"}
                    </button>

                    {[...Array(totalPages)].map((_, i) => (
                        <button
                            key={i + 1}
                            onClick={() => setPage(i + 1)}
                            className={`border border-slate-400 rounded px-2 py-1 text-xs ${page === i + 1
                                ? "bg-slate-200 text-slate-800 font-medium"
                                : "bg-white text-slate-600"
                                }`}
                        >
                            {i + 1}
                        </button>
                    ))}

                    <button
                        disabled={page === totalPages || totalPages === 0}
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        className="border border-slate-400 rounded px-2 py-1 text-xs text-slate-600 bg-white disabled:opacity-50"
                    >
                        {">"}
                    </button>
                </div>
            </div>

            {/* 🧩 Modal de confirmación */}
            <Dialog open={!!propertyToDelete} onOpenChange={(open) => !open && setPropertyToDelete(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Eliminar {propertyToDelete?.title}</DialogTitle>
                        <DialogDescription>
                            Estás a punto de eliminar {propertyToDelete?.title}. Esta acción no se puede deshacer.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setPropertyToDelete(null)} style={{cursor: "pointer"}}>
                            Cancelar
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={() => {
                                if (propertyToDelete) {
                                    handleClickDelete(propertyToDelete.id);
                                }
                            }}
                            style={{cursor: "pointer"}}
                        >
                            Eliminar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
