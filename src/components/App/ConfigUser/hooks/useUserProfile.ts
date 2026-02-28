import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";

export type UserProfile = {
    full_name: string;
    email: string;
    avatar_url: string;
    account_type: "basic" | "premium" | null;
    is_verified: boolean;
    whatsapp: string;
    brokerRequestStatus: "none" | "pending" | "approved" | "rejected";
};

export function useUserProfile() {
    const [loading, setLoading] = useState(true);
    const [profile, setProfile] = useState<UserProfile>({
        full_name: "",
        email: "",
        avatar_url: "",
        account_type: null,
        is_verified: false,
        whatsapp: "",
        brokerRequestStatus: "none",
    });

    useEffect(() => {
        fetchUser();
    }, []);

    const fetchUser = async () => {
        setLoading(true);

        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            setLoading(false);
            return;
        }

        const { data, error } = await supabase
            .from("users")
            .select(
                "full_name, email, avatar_url, account_type, is_verified, whatsapp"
            )
            .eq("id", user.id)
            .single();
        if (error) {
            console.error(error);
        } else {
            setProfile({
                full_name: data.full_name ?? "",
                email: data.email ?? "",
                avatar_url: data.avatar_url ?? "",
                account_type: data.account_type,
                is_verified: data.is_verified ?? false,
                whatsapp: data.whatsapp ?? "",
                brokerRequestStatus: "none",
            });
        }

        const { data: statusRequestUser, error: errorStatusRequestUser } = await supabase
            .from("account_requests")
            .select("status")
            .eq("user_id", user.id)
            .order("created_at", {ascending: false})
            .limit(1)
            .maybeSingle();

        if(errorStatusRequestUser){
            console.log("Error al traer el estado de la solicitud de broker")
        }
        if(statusRequestUser){
            const status = statusRequestUser.status;
            setProfile((prev)=>({
                ...prev, brokerRequestStatus: status,
            }))
        }

        setLoading(false);
    };

    const updateProfile = async (full_name: string, whatsapp: string) => {
        const whatsappRegex = /^[+]?[\d\s()-]{7,20}$/;

        if (!whatsappRegex.test(whatsapp.trim())) {
            toast.error("Número de WhatsApp inválido");
            return;
        }

        setLoading(true);

        const {
            data: { user },
        } = await supabase.auth.getUser();

        const { error } = await supabase
            .from("users")
            .update({
                full_name: full_name.trim(),
                whatsapp: whatsapp.trim(),
            })
            .eq("id", user?.id);

        if (error) {
            toast.error(error.message);
        } else {
            toast.success("Información actualizada");
            fetchUser();
        }

        setLoading(false);
    };

    const requestPremium = async () => {
        setLoading(true);

        const { error } = await supabase.functions.invoke(
            "request_account_upgrade",
            {
                body: { requested_type: "premium" },
            }
        );

        if (error) {
            toast.error("Error al solicitar actualización");
        } else {
            toast.success("Solicitud enviada correctamente");
            fetchUser();
        }

        setLoading(false);
    };

    return {
        profile,
        loading,
        updateProfile,
        requestPremium,
    };
}
