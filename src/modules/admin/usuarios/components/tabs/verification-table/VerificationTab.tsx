import { useState } from "react";
import useVerificationPending from "../../../hooks/useVerificationPending";
import { DataTable } from "@/components/ui/DataTable/data-table";
import { getColumns } from "./columns";
import RequestDetailsModal from "./RequestDetailsModal";
import type { VerificationRequest } from "../../../types";


export default function VerificationTab() {

    const {
        requests,
        fetchRequests
    } = useVerificationPending();


    const [openModal, setOpenModalState] =
        useState<null | "details">(null);


    const [selectedRequest, setSelectedRequest] =
        useState<VerificationRequest | null>(null);


    const [page, setPage] =
        useState(1);


    const [rowsPerPage, setRowsPerPage] =
        useState(10);



    const columns = getColumns({
        onViewDetails: (request) => {

            setSelectedRequest(request);

            setOpenModalState("details");

        }
    });



    const totalPages = Math.ceil(
        requests.length / rowsPerPage
    );



    return (
        <>
            <RequestDetailsModal
                open={openModal === "details"}
                request={selectedRequest}
                onClose={() => {
                    setOpenModalState(null);
                    setSelectedRequest(null);
                }}
                refreshData={fetchRequests}
            />

            <div className="flex flex-col gap-4">
                <DataTable
                    columns={columns}
                    data={requests}
                    page={page}
                    setPage={setPage}
                    rowsPerPage={rowsPerPage}
                    setRowsPerPage={setRowsPerPage}
                    totalPages={totalPages}
                />
            </div>

        </>
    );
}