import type { Property } from "@/types/property";
import { useUser } from "@/hooks/useUser";
import { getUserProperties } from "../services/property.service";
import { useEffect, useState } from "react";

export function useProperty() {

    const { idUser } = useUser(); // Assuming you have a useAuth hook to get the user ID
    const [properties, setProperties] = useState<Property[]>([]);
    const [page, setPage] = useState<number>(0);
    const [perPage, setPerPage] = useState<number>(12); // You can adjust this as needed

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
            const properties = await getUserProperties(idUser, page * perPage, (page + 1) * perPage - 1);
            setProperties(properties);
            console.log("Fetched properties:", properties);
            return properties;
        } catch (error) {
            console.error("Error fetching user properties:", error);
            throw error;
        }
    };

    return {
        properties,
        fetchUserProperties,
        page,
        setPage,
        perPage,
        setPerPage
    };

}