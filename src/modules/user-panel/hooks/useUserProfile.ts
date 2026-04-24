import { useEffect, useState } from "react";
import type { UserProfile } from "../types/UserProfile"
import { getCurrentUserProfile } from "../services/configuration.service";
import { useUser } from "@/hooks/useUser";

export function useUserProfile() {
    const [loading, setLoading] = useState(false);
    const [profile, setProfile] = useState<UserProfile>({
        full_name: "",
        email: "",
        avatar_url: "",
        account_type: null,
        is_verified: false,
        whatsapp: "",
        brokerRequestStatus: "none",
    });
    const { idUser } = useUser();

    useEffect(() => {
        if (!idUser) return;
        fetchPendingRequest(idUser);
    }, [idUser]);

    const fetchPendingRequest = async (id: string) => {
        setLoading(true);

        try {
            const data = await getCurrentUserProfile(id);

            if (data) {
                setProfile(data);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false); // 👈 SIEMPRE se ejecuta
        }
    };

    return {
        profile,
        loading,
    };
}
