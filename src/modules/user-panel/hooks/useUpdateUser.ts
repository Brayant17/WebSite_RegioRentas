import { useEffect, useState } from "react"
import { toast } from "sonner";
import { updateUser } from "../services/configuration.service";
import { useUser } from "@/hooks/useUser";

export function useUpdateUser() {


    const { idUser } = useUser()
    const [loading, setLoading] = useState(false);

    const handleUpdateUser = async (
        full_name: string,
        whatsapp: string
    ) => {

        if(!idUser){
            toast.error("usuario no autenticado");
            return;
        }

        const whatsappRegex = /^[+]?[\d\s()-]{7,20}$/;

        if (!whatsappRegex.test(whatsapp.trim())) {
            toast.error("Número de WhatsApp inválido")
            return;
        }

        setLoading(true);

        try {
            await updateUser(idUser, {
                full_name: full_name.trim(),
                whatsapp: whatsapp.trim(),
            });

            toast.success("Información actualizada")
        } catch (error: any) {
            toast.error(error.message || "Error al actualizar");
        } finally {
            setLoading(false);
        }
    }

    return {
        updateUser: handleUpdateUser,
        loading,
    };
}