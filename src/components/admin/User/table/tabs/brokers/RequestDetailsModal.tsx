import { Badge } from "@/components/ui/badge";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export default function RequestDetailsModal({ open, request, onClose }: { open: boolean, request: any, onClose: () => void }) {

    console.log("Request details:", request);

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Detalles de la solicitud</DialogTitle>
                    <DialogDescription>
                        Gestionar la solicitud de afiliación de {request?.user_name}
                    </DialogDescription>
                </DialogHeader>
                <div>
                    <p><strong>Nombre del usuario:</strong> {request?.user_name} <Badge className="bg-yellow-50 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300" variant="outline">{request?.status}</Badge> </p>
                    <p><strong>Email:</strong> {request?.user_email}</p>
                    <p><strong>Fecha de solicitud:</strong> {new Date(request?.created_at).toLocaleDateString()}</p>
                </div>
            </DialogContent>
        </Dialog>
    );
}