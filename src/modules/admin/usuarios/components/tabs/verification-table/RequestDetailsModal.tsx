import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { VerificationRequest } from "../../../types";
import { supabase } from "@/lib/supabaseClient";
import { useState } from "react";
import { toast } from "sonner";

type Props = {
    open: boolean;
    request: VerificationRequest | null;
    onClose: () => void;
    refreshData?: () => void;
}

const sendRequestDecision = async (
    request_id: string,
    decision: "approved" | "rejected",
    review_comment?: string
) => {

    // 1. Actualizar solicitud
    const { data: request, error: requestError } = await supabase
        .from("account_requests")
        .update({
            status: decision,
            review_comment
        })
        .eq("id", request_id)
        .select(`
            id,
            user_id,
            requested_type
        `)
        .single();


    if (requestError) {
        throw requestError;
    }


    // 2. Si es verificación de identidad aprobada
    // actualizar usuario
    if (
        decision === "approved" &&
        request.requested_type === "identity_verification"
    ) {

        const { error: userError } = await supabase
            .from("users")
            .update({
                is_verified: true
            })
            .eq(
                "id",
                request.user_id
            );


        if (userError) {
            throw userError;
        }

    }


    return request;
};


export default function RequestDetailsModal({ open, request, onClose, refreshData }: Props) {

    const [loading, setLoading] = useState(false);
    const [comment, setComment] = useState("");

    if (!request) {
        return null;
    }

    const handleClickApprove = async () => {
        try {
            setLoading(true);

            await sendRequestDecision(request.id, "approved", comment);

            toast.success(`Solicitud de ${request?.user.fullName} aprobada`, { position: "top-center" });
            onClose();
            refreshData?.();

        } catch (err) {
            console.error(err);
            toast.error(`Error al aprobar solicitud de ${request?.user.fullName}`, { position: "top-center" });
        } finally {
            setLoading(false);
        }
    };

    const handleClickReject = async () => {
        try {
            setLoading(true);

            await sendRequestDecision(request.id, "rejected", comment);

            toast.success(`Solicitud de ${request?.user.fullName} rechazada`, { position: "top-center" });
            onClose();
            refreshData?.();
        } catch (err) {
            console.error(err);
            toast.error(`Error al rechazar solicitud de ${request?.user.fullName}`, { position: "top-center" });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl">

                <DialogHeader>
                    <DialogTitle>
                        Solicitud de verificación de identidad
                    </DialogTitle>

                    <DialogDescription>
                        Revisar documentos enviados por el usuario.
                    </DialogDescription>
                </DialogHeader>


                {/* Información usuario */}
                <section className="p-4 bg-gray-100/50 rounded-md space-y-2">

                    <div className="flex items-center justify-between">

                        <div className="flex items-center gap-2">

                            <p className="font-semibold text-neutral-900">
                                {request?.user.fullName}
                            </p>


                            <Badge
                                variant="outline"
                                className="bg-yellow-50 text-yellow-700"
                            >
                                {request?.status}
                            </Badge>

                        </div>

                    </div>


                    <p className="text-neutral-700">
                        {request?.user.email}
                    </p>


                    <p className="text-xs text-gray-500">
                        ID solicitud: {request?.id}
                    </p>

                </section>


                {/* Fecha */}
                <section className="flex justify-between">

                    <div>

                        <p className="text-sm text-gray-500">
                            Fecha solicitud
                        </p>

                        <p className="font-semibold">
                            {request &&
                                new Date(
                                    request.createdAt
                                ).toLocaleString()
                            }
                        </p>

                    </div>


                    <div>

                        <p className="text-sm text-gray-500">
                            Tipo
                        </p>

                        <p className="font-semibold">
                            {request?.requestedType}
                        </p>

                    </div>

                </section>


                {/* Documentos */}
                <section>

                    <h3 className="font-semibold mb-3">
                        Documentos enviados
                    </h3>


                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">


                        {request?.documents.map((document) => (

                            <div
                                key={document.id}
                                className="border rounded-lg overflow-hidden"
                            >

                                {document.signedUrl ? (

                                    <img
                                        src={document.signedUrl}
                                        alt={document.documentType}
                                        className="
                                w-full
                                h-48
                                object-cover
                            "
                                    />

                                ) : (

                                    <div className="
                            h-48
                            flex
                            items-center
                            justify-center
                            bg-gray-100
                        ">
                                        Sin imagen
                                    </div>

                                )}


                                <div className="p-3">

                                    <p className="font-medium text-sm">
                                        {document.documentType}
                                    </p>

                                    <p className="text-xs text-gray-500">
                                        {document.fileName}
                                    </p>

                                </div>

                            </div>

                        ))}


                    </div>

                </section>


                {/* Comentarios */}
                <section>

                    <p className="text-gray-500 mb-2">
                        Comentarios del administrador
                    </p>


                    <Textarea
                        className="h-24"
                        placeholder="Escribe comentarios aquí..."
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                    />


                </section>


                <DialogFooter>

                    <Button
                        variant="outline"
                        onClick={onClose}
                    >
                        Cancelar
                    </Button>


                    <Button
                        variant="destructive"
                        onClick={handleClickReject}
                        disabled={loading}
                    >
                        Rechazar
                    </Button>


                    <Button
                        onClick={handleClickApprove}
                        disabled={loading}
                    >
                        {loading
                            ? "Procesando..."
                            : "Aprobar"
                        }
                    </Button>


                </DialogFooter>


            </DialogContent>
        </Dialog >
    );
}