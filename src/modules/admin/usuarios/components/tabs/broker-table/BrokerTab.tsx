import { useState } from "react";
import useRequestPending from "../../../hooks/useRequestPending";
import { DataTable } from "@/components/ui/DataTable/data-table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import { getColumns } from "./columns";
import RequestDetailsModal from "./RequestDetailsModal";

export default function BrokerTab() {
    const { requests, setRequests, fetchRequests } = useRequestPending()
    const [openModal, setOpenModalState] = useState<null | "details">(null) //
    const [selectedRequest, setSelectedRequest] = useState<any>(null) //

    const columns = getColumns({
        onViewDetails: (request) => {
            setSelectedRequest(request)
            setOpenModalState("details")
        }
    })

    return (
        <>
            <RequestDetailsModal open={openModal === "details"} request={selectedRequest} onClose={() => setOpenModalState(null)} refreshData={fetchRequests} />
            <div className="flex flex-col gap-4">
                <Alert className="border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-50">
                    <AlertTriangle />
                    <AlertTitle>
                        Solicitudes de Premium Pendientes
                    </AlertTitle>
                    <AlertDescription>
                        Estás en la sección de solicitudes de actualización a cuenta premium.
                        Revisa cuidadosamente cada solicitud antes de aprobarla o rechazarla.
                        Asegúrate de validar la información del usuario para evitar errores o accesos indebidos.
                    </AlertDescription>
                </Alert>

                <DataTable columns={columns} data={requests} />
            </div>
        </>
    )
}