// src/modules/user-panel/services/verification.service.ts

import { supabase } from "@/lib/supabaseClient";

export interface SubmitVerificationPayload {
    frontFile: File;
    backFile: File;
    selfieFile: File;
}

type VerificationDocumentType =
    | "id_front"
    | "id_back"
    | "selfie";

class VerificationService {
    async submitVerification(payload: SubmitVerificationPayload) {

        const user = await this.checkExistingRequest();

        const request = await this.createRequest(user.id);

        const uploadedPaths: string[] = [];

        try {

            uploadedPaths.push(
                await this.uploadDocument(
                    user.id,
                    request.id,
                    payload.frontFile,
                    "id_front"
                )
            );

            uploadedPaths.push(
                await this.uploadDocument(
                    user.id,
                    request.id,
                    payload.backFile,
                    "id_back"
                )
            );

            uploadedPaths.push(
                await this.uploadDocument(
                    user.id,
                    request.id,
                    payload.selfieFile,
                    "selfie"
                )
            );

            return request;

        } catch (error) {
            console.error("Verification upload failed:", error);
            await this.rollbackVerification(
                request.id,
                uploadedPaths
            );
            throw new Error(
                "No fue posible enviar tu solicitud de verificación. Inténtalo nuevamente."
            );
        }
    }

    private async checkExistingRequest() {
        const {
            data: { user },
            error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
            throw new Error("Usuario no autenticado.");
        }

        const { data, error } = await supabase
            .from("account_requests")
            .select("id, status")
            .eq("user_id", user.id)
            .eq("requested_type", "identity_verification")
            .in("status", ["pending", "approved"])
            .maybeSingle();

        if (error) {
            throw error;
        }

        if (data) {
            if (data.status === "pending") {
                throw new Error(
                    "Ya tienes una solicitud de verificación en revisión."
                );
            }

            if (data.status === "approved") {
                throw new Error(
                    "Tu cuenta ya se encuentra verificada."
                );
            }
        }

        return user;
    }

    private async createRequest(userId: string) {
        const { data, error } = await supabase
            .from("account_requests")
            .insert({
                user_id: userId,
                requested_type: "identity_verification",
                status: "pending",
            })
            .select()
            .single();

        if (error) throw error;

        return data;
    }

    private getFileExtension(file: File) {
        return file.name.split(".").pop()?.toLowerCase() || "jpg";
    }

    private async uploadDocument(
        userId: string,
        requestId: string,
        file: File,
        documentType: VerificationDocumentType
    ): Promise<string> {

        const EXTENSION = this.getFileExtension(file);

        const storagePath =
            `${userId}/${requestId}/${documentType}.${EXTENSION}`;

        const { error } = await supabase.storage
            .from("verification-documents")
            .upload(storagePath, file, {
                upsert: false,
                contentType: file.type
            });

        if (error) throw error;

        const { error: dbError } = await supabase
            .from("account_request_documents")
            .insert({
                account_request_id: requestId,
                document_type: documentType,
                storage_path: storagePath,
                file_name: file.name,
                mime_type: file.type
            });

        if (dbError) throw dbError;

        return storagePath;
    }

    private async rollbackVerification(
        requestId: string,
        uploadedPaths: string[]
    ) {
        // 1. Eliminar archivos del bucket
        if (uploadedPaths.length > 0) {
            await supabase.storage
                .from("verification-documents")
                .remove(uploadedPaths);
        }

        // 2. Eliminar la solicitud
        await supabase
            .from("account_requests")
            .delete()
            .eq("id", requestId);
    }
}

export const verificationService = new VerificationService();