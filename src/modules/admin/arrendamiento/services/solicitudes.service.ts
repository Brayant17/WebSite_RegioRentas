import { getApplications } from "../repositories/solicitudes.repository"

export async function getListApplication(){
    
    const applications = await getApplications();

    return applications
} 