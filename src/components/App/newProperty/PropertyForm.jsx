// ----- Añadir funcionalidad para gestionar la visibilidad de las propiedades (público/privado) -----

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
import PublicationStatus from "./PublicationStatus";

export default function NewProperty({ propertyId }) {
    const [saveSuccess, setSaveSuccess] = useState(false);
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

        // 3. Subir imágenes nuevas
        const newFiles = files.filter(f => !f.isExisting);

        for (let index = 0; index < newFiles.length; index++) {
            const fileObj = newFiles[index];
            const fileName = `${Date.now()}-${fileObj.file.name}`;
            const filePath = `${userId}/${currentPropertyId}/${fileName}`;

            // 🟢 Subir a Supabase Storage
            const { data: uploadData, error: uploadError } = await supabase.storage
                .from("properties")
                .upload(filePath, fileObj.file, { upsert: true });

            if (uploadError) {
                console.error("❌ Error subiendo archivo:", uploadError.message);
                continue;
            }

            // 🟢 Obtener URL pública
            const { data: urlData, error: urlError } = supabase.storage
                .from("properties")
                .getPublicUrl(filePath);

            if (urlError) {
                console.error("❌ Error obteniendo URL pública:", urlError.message);
                continue;
            }

            const publicUrl = urlData?.publicUrl;
            // 🔹 Determinar su posición real según el array 'files'
            const fileIndexInFullList = files.findIndex(f => f.file?.name === fileObj.file.name);

            // 🟢 Insertar en la tabla property_images
            const { data: insertedImages, error: insertError } = await supabase.from("property_images").insert([{
                property_id: currentPropertyId,
                url: publicUrl,
                filename: fileName,
                order: fileIndexInFullList + 1
            }])
                .select("id"); // para obtener el id real generado por supabase

            if (insertError) {
                console.error("❌ Error insertando imagen en DB:", insertError.message);
                continue;
            }

            console.log(insertedImages);
            console.log("Objeto de file: ", fileObj);

            const newId = insertedImages?.[0]?.id;

            // actualizar el array en memoria con el UUID real
            fileObj.filename = fileName
            fileObj.id = newId;
            fileObj.isExisting = true
            fileObj.preview = publicUrl;
        }

        // ⚠️ Muy importante: forzar el estado antes de actualizar orden
        setFiles(prev => [...prev]);
        await new Promise(resolve => setTimeout(resolve, 200)); // pequeño delay opcional

        // 4. Eliminar imágenes marcadas para borrar usando el endpoint
        for (const delFile of deletedFiles) {
            console.log(deletedFiles);
            if (delFile.isExisting) {
                try {
                    const path = `${userId}/${currentPropertyId}/${delFile.filename}`;
                    console.log(path);
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

        /// 5. Actualizar orden de imágenes existentes
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            if (file.isExisting && /^[0-9a-fA-F-]{36}$/.test(file.id)) { // ✅ solo UUID válidos
                const { error: updateOrderError } = await supabase
                    .from("property_images")
                    .update({ order: i + 1 })
                    .eq("id", file.id);

                if (updateOrderError) {
                    console.error(`❌ Error actualizando orden (${file.filename}):`, updateOrderError.message);
                }
            }
        }

        files.forEach(f => {
            if (f.preview?.startsWith("blob:")) URL.revokeObjectURL(f.preview);
        });

        setSaving(false);

        // 7. Redirección o alerta según corresponda
        if (!propertyId) {
            window.location.href = `/panel/publicaciones/editar/${currentPropertyId}`;
        } else {
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 3000);
        }
    };

    if (loading) return <p>Cargando propiedad</p>

    return (
        <div className="flex flex-col gap-4 md:gap-0 md:flex-row">
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
                        <PhysicalState furnished={propertyData.furnished} setterState={setPropertyData} />
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
            {/* Panel derecho */}
            <div className="flex-1/4 md:mx-4">
                <div className="md:sticky md:top-30 bg-gray-50 border border-slate-200 rounded-sm p-4 shadow-sm flex flex-col gap-5">
                    <div className="flex flex-col gap-4">
                        <h3 className="text-base font-semibold text-slate-800 border-b border-slate-200 pb-2">
                            Opciones de publicación
                        </h3>

                        {/* {Estado de la publicacion} */}
                        <PublicationStatus setterState={setPropertyData} />

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

                    {/* Mensaje de éxito visual (no bloqueante) */}
                    {saveSuccess && (
                        <div className="fixed bottom-5 right-5 bg-green-600 text-white text-sm px-4 py-2 rounded-lg shadow-lg animate-fade-in">
                            ✅ Propiedad guardada correctamente
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
