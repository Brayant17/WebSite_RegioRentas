import { useEffect, useState } from "react";
import type { UserProfile } from "../types/UserProfile"
import { getCurrentUserProfile } from "../services/configuration.service";
import { useUser } from "@/hooks/useUser";

export function useUserProfile() {
    const { idUser } = useUser();
    const [loading, setLoading] = useState(false);
    const [profile, setProfile] = useState<UserProfile>({
        full_name: "",
        email: "",
        avatar_url: "",
        account_type: null,
        is_verified: false,
        whatsapp: "",
        brokerRequestStatus: "none",
        verificationRequestStatus: null,
    });

    useEffect(() => {
        fetchPendingRequest ();
    }, [idUser]);
    
    const fetchPendingRequest = async () => {
        setLoading(true);
        if(!idUser){
            setLoading(false);
            return;
        }
        try {
            const data = await getCurrentUserProfile(idUser);

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
        refresh: fetchPendingRequest,
        loading,
    };
}
