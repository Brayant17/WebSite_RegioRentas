import type { ApplicationDetail, DocumentoPersonal } from "../types/database.type";
import { supabase } from "@/lib/supabaseClient";

export async function getSignedUrl(path: string) {
    const { data, error } = await supabase
        .storage
        .from("rental-documents")
        .createSignedUrl(path, 300);

    if (error) {
        throw error;
    }

    return data.signedUrl;
}


export async function getDocumentsSignedUrls(documents: DocumentoPersonal[]) {

  const documentsWithUrls = await Promise.all(
    documents.map(async (document: DocumentoPersonal) => {

        const signedUrl = await getSignedUrl(document.url);

        return {
            ...document,
            url: signedUrl
        };
    })
);

return documentsWithUrls;
}