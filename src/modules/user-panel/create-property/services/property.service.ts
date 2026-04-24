// services/propertyService.js
import { propertyRepository } from "../repositories/propertyRepository";
import type { Property } from "../types/Property.form";
import type { ImageItem } from "../types/ImageItem.type";

export const propertyService = {
    async getFullProperty(propertyId: string) {
        const property = await propertyRepository.getById(propertyId);
        const images = await propertyRepository.getImages(propertyId);

        const imagesFormat: ImageItem[] = images.map((img) => ({
            id: img.id,
            url: img.url,
            status: "existing",
        }));

        return { property, imagesFormat };
    },

    async saveProperty({
        propertyData,
        files,
        propertyId,
    }: {
        propertyData: Property;
        files: ImageItem[];
        propertyId?: string;
    }) {
        const userId = propertyData.user_id!;
        let currentPropertyId = propertyId;

        //crear o actualizar propiedad
        if (!propertyId) {
            const created = await propertyRepository.create({
                ...propertyData,
                user_id: userId,
            });
            currentPropertyId = created.id;
        } else {
            await propertyRepository.update(propertyId, propertyData);
        }

        //eliminar imágenes
        const deletedImages = files.filter(f => f.status === "deleted");

        if (deletedImages.length > 0) {
            const ids = deletedImages
                .map(img => img.id)
                .filter(Boolean) as string[];

            if (ids.length > 0) {
                await propertyRepository.deleteImages(ids);
            }
        }

        //subir nuevas imágenes
        let uploadedImages: any[] = [];

        if (currentPropertyId && userId) {
            const newFiles = files
                .filter(f => f.status === "new" && f.file instanceof File)
                .map(f => ({
                    file: f.file as File,
                    client_id: f.id,
                }));

            if (newFiles.length > 0) {
                uploadedImages = await propertyRepository.uploadImages(
                    newFiles,
                    currentPropertyId,
                    userId
                );
            }
        }

        const orderedIds = files.filter(f => f.status !== "deleted").map(f => f.id);

        if(orderedIds.length > 0) {
            await propertyRepository.updateImageOrder(orderedIds as string[]);
        }

        // esto es lo importante
        return {
            propertyId: currentPropertyId,
            uploadedImages, //para reconcile
        };
    },

};
