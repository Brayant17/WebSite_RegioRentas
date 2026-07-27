import { supabase } from "@/lib/supabaseClient";

const BUCKET_NAME = "rental-documents";

export async function uploadDocumentRepository(
  formData: FormData
) {
  const { data, error } = await supabase.functions.invoke(
    "upload-rental-document",
    {
      body: formData,
    }
  );

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function deleteDocumentRepository(
  path: string
) {
  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .remove([path]);

  if (error) {
    throw new Error(error.message);
  }
}