import { supabase } from "@/lib/supabaseClient"
import type { CreateApplicationDTO } from "@/modules/arrendamiento/dtos/create-application-dto"
import type { ResultadoConsulta } from "../types/checkFolio.type";

export interface SolicitudResponse {
    id: string;
    folio: string;
    persona_id: string;
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

        return data as SolicitudResponse
    }
}

export async function checkSatusByFolio(folio: string): Promise<ResultadoConsulta> {
    const { data, error } = await supabase
        .rpc("check_status_solicitud",
            {
                p_folio: folio
            }
        );

    if (error) {
        throw error
    }

    return data
}