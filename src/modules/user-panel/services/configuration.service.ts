import type { UserProfile } from "../types/UserProfile";
import { getCurrentUser, requestAccountPremium, getLatestBrokerRequest, updateUserRepo, getLatestVerificationRequest } from "../repositories/configuration.respository";

export async function getCurrentUserProfile(idUser: string): Promise<UserProfile> {

    const [
        { data: user },
        { data: brokerRequest },
        { data: verificationRequest }
    ] = await Promise.all([
        getCurrentUser(idUser),
        getLatestBrokerRequest(idUser),
        getLatestVerificationRequest(idUser)
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

        brokerRequestStatus: brokerRequest?.status ?? "none",

        verificationRequestStatus:
            verificationRequest?.status ?? null,
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


export async function requestPremium() {
    const { error } = await requestAccountPremium();

    if (error) {
        throw new Error(error.message);
    }
    return true;
}