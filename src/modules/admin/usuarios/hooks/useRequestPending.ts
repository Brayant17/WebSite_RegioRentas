import { useEffect, useState } from "react";
import type { RequestPremium } from "../types";
import { fetchPendingRequest } from "../services/users.service";

export default function useRequestPending() { 
    const [requests, setRequests] = useState<RequestPremium[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchRequests();
    }, []);

    const fetchRequests = async () => {
        setLoading(true);
        setError(null);
        try {
            const {data} = await fetchPendingRequest();
            setRequests(data);
        } catch (error) {
            console.error("Error fetching pending requests:", error);
            setError("Error fetching pending requests");
        } finally {
            setLoading(false);
        }
    };

    return {
        loading,
        error,
        requests,
        setRequests,
        fetchRequests
    }
}