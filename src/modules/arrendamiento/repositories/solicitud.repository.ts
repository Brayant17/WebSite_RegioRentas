import { supabase } from "@/lib/supabaseClient"
import type { CreateApplicationDTO } from "@/modules/arrendamiento/dtos/create-application-dto"

interface SolicitudResponse {
    id: string;
    folio: string;
}

export class SolicitudRepository {
    async createApplication(application: CreateApplicationDTO): Promise<SolicitudResponse> {
        const { data, error } = await supabase.functions.invoke("crear-solicitud", {
            body: application
        })

        if (error) {
            console.log(error)
            throw new Error(error.message);
        }

        return data
    }

    async createDocument() { }
}