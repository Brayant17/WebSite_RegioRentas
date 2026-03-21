import type { UserProfile } from "../types/UserProfile";
import { getCurrentUser, getLatestRequestStatus, updateUserRepo } from "../repositories/configuration.respository";

export async function getCurrentUserProfile(idUser: string): Promise<UserProfile> {

    const [{ data: user }, { data: request }] = await Promise.all([
        getCurrentUser(idUser),
        getLatestRequestStatus(idUser)
    ]);

    if (!user) {
        throw new Error("Error al obtener el usuario");
    }

    return {
        full_name: user.full_name ?? "",
        email: user.email ?? "",
        avatar_url: user.avatar_url ?? "",
        account_type: user.account_type ?? null,
        is_verified: user.is_verified ?? false,
        whatsapp: user.whatsapp ?? "",
        brokerRequestStatus: request?.status ?? "none",
    };

}

export async function updateUser(idUser: string, data: { full_name: string, whatsapp: string }) {
    if (!idUser && !data) return null
    const { error } = await updateUserRepo(idUser, data);

    if (error) {
        throw new Error(error.message);
    }

    return true;
}

