import { useEffect, useState } from "react";
import type { VerificationRequest } from "../types";
import { getPendingVerificationRequest } from "../services/users.service";



export default function useVerificationPending() {
    const [requests, setRequests] =
        useState<VerificationRequest[]>([]);

    const [loading, setLoading] =
        useState(false);

    const [error, setError] =
        useState<string | null>(null);

    useEffect(() => {
        fetchRequests();
    }, []);


    const fetchRequests = async () => {
        try {
            setLoading(true);
            setError(null);
            const data =
                await getPendingVerificationRequest();
            setRequests(data);
        } catch (error) {
           console.error(error);
            setError(
                "Error cargando solicitudes"
            );

        } finally {
          setLoading(false);
        }

    };



    return {
        requests,
        setRequests,
        loading,
        error,
        fetchRequests
    };

}