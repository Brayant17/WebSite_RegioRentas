import { getDocumentsSignedUrls } from "@/modules/admin/arrendamiento/repositories/documents.repository";
import { getApplicationById, getApplications } from "../repositories/solicitudes.repository"

export async function getListApplication(){
    
    const applications = await getApplications();

    return applications
} 

export async function getApplication(idSolicitud: string){
    const application = await getApplicationById(idSolicitud);

    if (application.documentos_personales?.length){
        const documents = await getDocumentsSignedUrls(application.documentos_personales)
        return {
            ...application,
            documentos_personales: documents
        }
    }

    return application
}