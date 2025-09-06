// ----- Validar antes de guardar la informacion, para que no se escapen datos vacios -----
// ----- AL momento de editar mejorar le señal para mostrar que se edito correctamente -----
// ----- Agregar para eliminar una propiedad tanto el registro como las imagenes asociadas a esa propiedad y los archivos del storage, asi como su carpeta de la propiedad

// utilidades
import { useEffect, useState } from "react";
import { initialPropertyData } from "../../../constants/propertyDefault"
import { supabase } from "../../../lib/supabaseClient";

// Componentes
import TitleSlug from "./TitleSlug";
import Description from "./Description";
import TypePropertyOperation from "./TypePropertyOperation"
import Features from "./Features";
import PhysicalState from "./PhysicalState";
import Services from "./Services";
import Location from "./Location";
import Amenities from "./Amenities";
import Status from "./Status";
import Fechas from "./Fechas"
import DropZone from "./DropZone";

export default function NewProperty({ propertyId }) {
    const [propertyData, setPropertyData] = useState(initialPropertyData);
    const [files, setFiles] = useState([]);
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(!!propertyId)
    const [deletedFiles, setDeletedFiles] = useState([]);

    useEffect(() => {
        if (propertyId) {
            const fetchProperty = async () => {
                const { data: property, error: propertyError } = await supabase
                    .from("properties")
                    .select("*")
                    .eq("id", propertyId)
                    .single();

                if (propertyError) {
                    console.error("Error cargando propiedad:", propertyError.message);
                    return;
                }

                setPropertyData(property);

                const { data: images, error: imagesError } = await supabase
                    .from("property_images")
                    .select("*")
                    .eq("property_id", propertyId)
                    .order("order", { ascending: true });

                if (imagesError) {
                    console.error("Error cargando imágenes:", imagesError.message);
                } else {
                    setFiles(images.map(img => ({
                        preview: img.url,
                        filename: img.filename,
                        id: img.id,
                        isExisting: true
                    })));
                }

                setLoading(false);
            };

            fetchProperty();
        }
    }, [propertyId]);
    
    // Revisar esta funcion asincrona para subir las imagenes a supabase
    // Guardar (Editar o Crear)
    const handleSave = async () => {
        setSaving(true);

        // 0. Validación básica
        if (!propertyData.title || !propertyData.description) {
            alert("Completa todos los campos obligatorios: título y descripción");
            setSaving(false);
            return;
        }

        // 1. Obtener usuario actual
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError || !userData?.user) {
            console.error("Error obteniendo usuario:", userError?.message);
            setSaving(false);
            return;
        }
        const userId = userData.user.id;

        let currentPropertyId = propertyId;

        // 2. Crear nueva propiedad si no existe
        if (!propertyId) {
            const { data: insertData, error: insertError } = await supabase
                .from("properties")
                .insert([{ ...propertyData, user_id: userId }])
                .select()
                .single();

            if (insertError) {
                console.error("Error insertando propiedad:", insertError.message);
                setSaving(false);
                return;
            }
            currentPropertyId = insertData.id;
        } else {
            const { error: updateError } = await supabase
                .from("properties")
                .update(propertyData)
                .eq("id", propertyId);

            if (updateError) {
                console.log("Error actualizando propiedad: ", updateError.message);
            }
        }

        // Subir imagenes
        const newFiles = files.filter(f => !f.isExisting);
        for (const fileObj of newFiles) {
            const fileName = `${Date.now()}-${fileObj.file.name}`;
            const filePath = `${userId}/${currentPropertyId}/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from("properties")
                .upload(filePath, fileObj.file);

            if (uploadError) {
                console.error("Error subiendo archivo:", uploadError.message);
                continue;
            }

            const { data: publicUrlData } = supabase.storage
                .from("properties")
                .getPublicUrl(filePath);

            // Guardar en la tabla property_images
            await supabase.from("property_images").insert([{
                property_id: currentPropertyId,
                url: publicUrlData.publicUrl,
                filename: fileName
            }]);
        }

        // 5. Eliminar imágenes marcadas para borrar usando el endpoint
        for (const delFile of deletedFiles) {
            if (delFile.isExisting) {
                try {
                    const path = `${userId}/${currentPropertyId}/${delFile.filename}`;
                    const res = await fetch('/api/delete-image', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ path }),
                    });

                    const data = await res.json();
                    if (!res.ok) {
                        console.error("Error eliminando imagen desde endpoint:", data.error);
                        continue;
                    }

                    // Eliminar de la tabla
                    await supabase.from("property_images").delete().eq("id", delFile.id);
                } catch (err) {
                    console.error("Error llamando al endpoint de eliminación:", err);
                }
            }
        }


        setSaving(false);

        // 7. Redirección o alerta según corresponda
        if (!propertyId) {
            window.location.href = `/App/propiedad/editar/${currentPropertyId}`;
        } else {
            alert("Propiedad actualizada con éxito");
        }
    };

    if (loading) return <p>Cargando propiedad</p>

    return (
        <div className="flex flex-col md:flex-row">
            <div className="flex flex-col gap-10 flex-4/5 border border-slate-200 rounded p-4">
                <div className="flex flex-col gap-1.5">
                    <TitleSlug title={propertyData.title} slug={propertyData.slug} setterState={setPropertyData} />
                </div>
                <div>
                    <Description description={propertyData.description} setterState={setPropertyData} />
                </div>

                <div>
                    <h4 className="font-semibold">Tipo y Características</h4>
                    <div className="flex flex-wrap w-full justify-between">
                        <TypePropertyOperation propertyType={propertyData.property_type} operation={propertyData.operation} setterState={setPropertyData} />
                        <PhysicalState yearBuilt={propertyData.year_built} condition={propertyData.condition} furnished={propertyData.furnished} setterState={setPropertyData} />
                    </div>
                    <div className="flex w-full">
                        <Features price={propertyData.price} area={propertyData.area} floors={propertyData.floors} bedrooms={propertyData.bedrooms} bathrooms={propertyData.bathrooms} parking={propertyData.parking} setterState={setPropertyData} />
                    </div>
                </div>

                <div>
                    <h4 className="font-semibold">Ubicación</h4>
                    <Location estado={propertyData.estado} municipio={propertyData.municipio} colonia={propertyData.colonia} zona={propertyData.zona} setterState={setPropertyData} />
                </div>

                <div className="w-full">
                    <h4 className="font-semibold">Servicios</h4>
                    <Services servicesChecked={propertyData.services} setterState={setPropertyData} />
                </div>
                <div className="w-full">
                    <h4 className="font-semibold">Amenidades</h4>
                    <Amenities amenitiesChecked={propertyData.amenities} setterState={setPropertyData} />
                </div>

                <div className="w-full">
                    <h4 className="font-semibold">Multimedia</h4>
                    <span className="inline-block my-1.5 text-sm text-neutral-800 font-semibold">Imagenes de la propiedad</span>
                    <DropZone files={files} setFiles={setFiles} deletedFiles={deletedFiles} setDeletedFiles={setDeletedFiles} />
                </div>
            </div>
            <div className="flex-1/5 mx-4">
                <div className="p-2 border border-gray-300 rounded flex flex-col gap-4">
                    <Status setterStatus={setPropertyData} />
                    <Fechas availableFrom={propertyData.available_from} setterState={setPropertyData} />
                    <button
                        className="cursor-pointer border bg-neutral-800 text-white rounded-md p-2.5 hover:bg-neutral-950 duration-300 flex justify-center items-center gap-2"
                        onClick={handleSave}
                        disabled={saving}
                    >
                        {saving ? (
                            <>
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin icon icon-tabler icons-tabler-outline icon-tabler-loader-2"><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path d="M12 3a9 9 0 1 0 9 9" /></svg>
                                <span>Guardando</span>
                            </>
                        ) : (
                            <span>Guardar</span>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
