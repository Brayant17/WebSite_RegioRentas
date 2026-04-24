import Fechas from "./Fechas";
import PublicationStatus from "./PublicationStatus";
import Status from "./Status";
import type { Property } from "../types/Property.form";
import { useState } from "react";
import { toast } from "sonner";

type Props = {
    propertyData: Property;
    setPropertyData: React.Dispatch<React.SetStateAction<Property>>;
    save: () => Promise<string | undefined>;
}

export default function PublishingOptions({ propertyData, setPropertyData, save }: Props) {

    const [saving, setSaving] = useState(false);

    const propertyId = propertyData.id;

    const handleSave = async () => {
        setSaving(true);
        console.log("Guardando propiedad con datos: ", propertyData);
        try {
            const id = await save();
            if (!propertyId) {
                propertyData.id = id || null; // actualizar el estado con el nuevo ID después de crear la propiedad
                setPropertyData({ ...propertyData }); // disparar una actualización del estado para reflejar el nuevo ID
            }
            toast.success("Propiedad guardada correctamente");
        } catch (error) {
            console.error("Error al guardar la propiedad: ", error);
            toast.error("Error al guardar la propiedad");
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="flex-1/4 md:mx-4">
            <div className="md:sticky md:top-30 bg-gray-50 border border-slate-200 rounded-sm p-4 shadow-sm flex flex-col gap-5">
                <div className="flex flex-col gap-4">
                    <h3 className="text-base font-semibold text-slate-800 border-b border-slate-200 pb-2">
                        Opciones de publicación
                    </h3>

                    {/* {Estado de la publicacion} */}
                    <PublicationStatus setterState={setPropertyData} status={propertyData.is_public} />

                    {/* Estado */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">Estado</label>
                        <Status status={propertyData.status} setterStatus={setPropertyData} />
                    </div>

                    {/* Fecha */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">Disponible desde</label>
                        <Fechas availableFrom={propertyData.available_from} setterState={setPropertyData} />
                    </div>

                    {/* Línea divisoria */}
                    <div className="border-t border-slate-200 my-2"></div>

                    {/* Botón de guardar */}
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className={`w-full flex justify-center items-center gap-2 py-2.5 rounded-md font-medium transition-all duration-300 cursor-pointer 
                            ${saving
                                ? "bg-neutral-600 text-white opacity-80 cursor-not-allowed"
                                : "bg-neutral-900 hover:bg-neutral-950 text-white"
                            }`}
                    >
                        {saving ? (
                            <>
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    width="20"
                                    height="20"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    className="animate-spin"
                                >
                                    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                                    <path d="M12 3a9 9 0 1 0 9 9" />
                                </svg>
                                <span>Guardando...</span>
                            </>
                        ) : (
                            <span>{propertyId ? "Guardar cambios" : "Crear propiedad"}</span>
                        )}
                    </button>
                </div>
            </div>
        </div>
    )
}