import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { RequestPremium } from "./columns";
import { supabase } from "@/lib/supabaseClient";
import { useState } from "react";
import { toast } from "sonner";

type Props = {
    open: boolean;
    request: RequestPremium;
    onClose: () => void;
    refreshData?: () => void;
}

const sendRequestDecision = async (
    request_id: string,
    decision: "approved" | "rejected",
    review_comment?: string
) => {
    const { data, error } = await supabase.functions.invoke(
        "review_account_request",
        {
            body: {
                request_id,
                decision,
                review_comment
            }
        }
    );

    if (error) {
        throw error;
    }

    return data;
};


export default function RequestDetailsModal({ open, request, onClose, refreshData }: Props) {

    const [loading, setLoading] = useState(false);
    const [comment, setComment] = useState("");

    const handleClickApprove = async () => {
        try {
            setLoading(true);

            await sendRequestDecision(request.id, "approved", comment);

            toast.success(`Solicitud de ${request.user_name} aprobada`, { position: "top-center" });
            onClose();
            refreshData?.();

        } catch (err) {
            console.error(err);
            toast.error(`Error al aprobar solicitud de ${request.user_name}`, { position: "top-center" });
        } finally {
            setLoading(false);
        }
    };

    const handleClickReject = async () => {
        try {
            setLoading(true);

            await sendRequestDecision(request.id, "rejected", comment);

            toast.success(`Solicitud de ${request.user_name} rechazada`, { position: "top-center" });
            onClose();
            refreshData?.();
        } catch (err) {
            console.error(err);
            toast.error(`Error al rechazar solicitud de ${request.user_name}`, { position: "top-center" });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Detalles de la solicitud</DialogTitle>
                    <DialogDescription>
                        Gestionar la solicitud de afiliación de {request?.user_name}
                    </DialogDescription>
                </DialogHeader>
                <div className="p-2 flex flex-col gap-1 bg-gray-100/50 rounded-md">
                    <div className="flex justify-between">
                        <div className="flex items-center gap-2">
                            <p className="text-neutral-900 font-semibold">{request?.user_name}</p>
                            <Badge className="bg-yellow-50 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300 font-semibold" variant="outline">{request?.status}</Badge>
                        </div>
                    </div>
                    <p className="text-neutral-700">
                        {request?.user_email}
                    </p>
                    <p className="text-xs text-gray-500">
                        id: <span className="">{request?.id}</span>
                    </p>
                </div>
                <section className="flex items-center justify-between">
                    <div className="flex-1">
                        <p className=" text-gray-500">
                            Fecha de presentación
                        </p>
                        <p className="text-neutral-900 font-semibold">
                            {new Date(request?.created_at).toLocaleString()}
                        </p>
                    </div>
                    <div className="flex-1">
                        <p className="text-neutral-500">
                            Plan solicitado
                        </p>
                        <p className="text-neutral-900 font-semibold">{request?.requested_type}</p>
                    </div>
                </section>
                <section>
                    <p className="text-neutral-500 mb-2">
                        Comentarios del admin (opcional)
                    </p>
                    <Textarea
                        name="comments"
                        id="comments"
                        className="w-full h-24 p-2 border rounded-md"
                        placeholder="Escribe comentarios aquí..."
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                    />
                </section>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Cancelar</Button>
                    <Button variant="destructive" onClick={handleClickReject} disabled={loading}>Rechazar</Button>
                    <Button onClick={handleClickApprove} disabled={loading}>{loading ? "Procesando..." : "Aprobar"}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog >
    );
}