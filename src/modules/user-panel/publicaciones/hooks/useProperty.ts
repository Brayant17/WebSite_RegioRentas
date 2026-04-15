import type { Property } from "@/types/property";
import { useUser } from "@/hooks/useUser";
import { getUserProperties } from "../services/property.service";
import { useEffect, useState } from "react";

export function useProperty() {

    const { idUser } = useUser(); // Assuming you have a useAuth hook to get the user ID
    const [properties, setProperties] = useState<Property[]>([]);
    const [page, setPage] = useState<number>(0);
    const [perPage, setPerPage] = useState<number>(12); // You can adjust this as needed
    const [totalProperties, setTotalProperties] = useState<number>(1);

    useEffect(() => {
        if (idUser) {
            fetchUserProperties();
        }

    }, [idUser, page, perPage]);

    // Hook implementation
    const fetchUserProperties = async () => {

        if (!idUser) {
            console.error("User ID is not available.");
            return;
        }

        try {
            const { data, count } = await getUserProperties(
                idUser,
                (page - 1) * perPage,
                page * perPage - 1
            );

            setProperties(data || []);
            setTotalProperties(count || 0);
        } catch (error) {
            console.error(error);
        }
    };

    return {
        properties,
        setProperties,
        totalProperties,
        fetchUserProperties,
        page,
        setPage,
        perPage,
        setPerPage
    };

}