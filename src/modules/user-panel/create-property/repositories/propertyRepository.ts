// repositories/propertyRepository.js
import { supabase } from "@/lib/supabaseClient";
import type { Property } from "../types/Property.form";

export const propertyRepository = {
    async getById(id: string) {
        const { data, error } = await supabase
            .from("properties")
            .select("*")
            .eq("id", id)
            .single();

        if (error) throw error;
        return data;
    },

    async create(data: Property) {
        const { data: created, error } = await supabase
            .from("properties")
            .insert([data])
            .select()
            .single();

        if (error) throw error;
        return created;
    },

    async update(id: string, data: Property) {
        const { error } = await supabase
            .from("properties")
            .update(data)
            .eq("id", id);

        if (error) throw error;
    },

    async getImages(propertyId: string) {
        const { data, error } = await supabase
            .from("property_images")
            .select("*")
            .eq("property_id", propertyId)
            .order("order", { ascending: true });

        if (error) throw error;
        return data ?? [];
    },

    async uploadImages(
        files: { file: File; client_id: string }[],
        propertyId: string,
        userId: string
    ) {
        const formData = new FormData();

        files.forEach(({ file, client_id }) => {
            formData.append("files", file);
            formData.append("client_ids", client_id);
        });

        formData.append("property_id", propertyId);
        formData.append("user_id", userId);

        const { data, error } = await supabase.functions.invoke(
            "upload-images",
            { body: formData }
        );

        if (error) throw error;

        return data.images;
    },

    async deleteImages(imageIds: string[]) {
        const { data, error } = await supabase.functions.invoke(
            "delete-images",
            { body: { imageIds } }
        );

        if (error) throw error;

        return data;
    },

    async updateImageOrder(ids: string[]) {
        for (let i = 0; i < ids.length; i++) {
            const { error } = await supabase
                .from("property_images")
                .update({ order: i + 1 })
                .eq("id", ids[i]);

            if (error) throw error;
        }
    }

};
