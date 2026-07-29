import { supabase } from "@/lib/supabaseClient";
import type { ApplicationDetail, Solicitud } from "@/modules/admin/arrendamiento/types/database.type"

export async function getApplications() {
    const { data, error } = await supabase
        .from("solicitudes")
        .select(`
            id,
            folio,
            unidades:unidad_id(
                nombre,
                tipo,
                edificio:edificio_id(
                    nombre
                )
            ),
            participantes_solicitud (
                personas:persona_id (
                    nombre,
                    apellido_paterno,
                    telefono,
                    correo
                )
            ),
            estatus,
            created_at
        `)
        .eq("participantes_solicitud.rol", "solicitante") as {
            data: Solicitud[] | null;
            error: Error | null
        };

    if (error) {
        console.log(error)
    }

    return data?.map((solicitud) => ({
        id: solicitud.id,
        folio: solicitud.folio,
        applicantName:
            `${solicitud.participantes_solicitud[0].personas.nombre} ${solicitud.participantes_solicitud[0].personas.apellido_paterno}`,
        email: solicitud.participantes_solicitud[0].personas.correo,
        property: solicitud.unidades.edificio.nombre,
        unit: solicitud.unidades.nombre,
        propertyType: solicitud.unidades.tipo,
        status: solicitud.estatus as "pendiente" | "aprobada" | "rechazada",
        date: solicitud.created_at
    })) ?? [];
}


export async function getApplicationById(idSolicitud: string): Promise<ApplicationDetail> {
    const { data, error } = await supabase
        .from("solicitudescreadas")
        .select("*")
        .eq("solicitud_id", idSolicitud)
        .single();

    if (error) {
        throw error;
    }

    return data;
}