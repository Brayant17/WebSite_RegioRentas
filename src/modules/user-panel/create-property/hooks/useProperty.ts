// hooks/useProperty.js
// TODO: Refactorizar este hook para que sea más limpio y modular, evitando anidar tantas llamadas a Supabase y manejando mejor los errores. Mover a un endpoint API si es necesario.
import { useEffect, useState } from "react";
import { propertyService } from "../services/property.service";
import { initialPropertyData } from "../constants/propertyDefault";
import type { Property } from "../types/Property.form";
import type { ImageItem } from "../types/ImageItem.type";
import { useUser } from "@/hooks/useUser";


export function useProperty(propertyId: string | null) {
    const [propertyData, setPropertyData] = useState<Property>(initialPropertyData);
    const [files, setFiles] = useState<ImageItem[]>([]);
    const [loading, setLoading] = useState(!!propertyId);
    const [saving, setSaving] = useState(false);
    const { idUser } = useUser();


    useEffect(() => {
        if (!propertyId) return;

        const fetchData = async () => {
            try {
                const { property, imagesFormat: images } = await propertyService.getFullProperty(propertyId);
                setPropertyData(property);
                setFiles(images);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [propertyId]);

    const save = async () => {
        setSaving(true);

        try {
            const { propertyId: id, uploadedImages } =
                await propertyService.saveProperty({
                    propertyData: {
                        ...propertyData,
                        user_id: idUser || propertyData.user_id || ""
                    },
                    files: files,
                    propertyId: propertyData.id || undefined
                });

            // AQUÍ HACES EL RECONCILE
            if (uploadedImages && uploadedImages.length > 0) {
                setFiles(prev => reconcileImages(prev, uploadedImages));
            }

            return id;

        } catch (err) {
            console.error(err);
        } finally {
            setSaving(false);
        }
    };



    const reconcileImages = (
        files: ImageItem[],
        responseImages: any[]
    ): ImageItem[] => {

        const map = new Map(
            responseImages.map(img => [img.client_id, img])
        );

        return files.map(file => {
            if (file.status !== "new") return file;

            const match = map.get(file.id);

            if (!match) return file;

            return {
                id: match.id,
                url: match.url,
                status: "existing",
                selected: false,
            };
        });
    };



    return {
        propertyData,
        setPropertyData,
        files,
        setFiles,
        loading,
        saving,
        save
    };
}
