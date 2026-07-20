import { supabase } from "@/lib/supabaseClient";


const BUCKET_NAME = "rental-documents";


export async function uploadDocumentRepository(
    path: string,
    file: File
) {

    const { data, error } =
        await supabase.storage
            .from(BUCKET_NAME)
            .upload(
                path,
                file,
                {
                    cacheControl: "3600",
                    upsert: false,
                }
            );


    if (error) {
        throw new Error(error.message);
    }


    return data.path;
}


export async function deleteDocumentRepository(
    path: string
) {

    const { error } =
        await supabase.storage
            .from(BUCKET_NAME)
            .remove([
                path
            ]);


    if (error) {
        throw new Error(error.message);
    }

}