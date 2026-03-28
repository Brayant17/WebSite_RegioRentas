import { fetchUserProperties } from "../repositories/property.repository";

export async function getUserProperties(userId: string, from: number = 0, to: number = 9) {
    try {
        const properties = await fetchUserProperties({ userId, from, to });
        return properties;
    } catch (error) {
        console.error("Error fetching user properties:", error);
        throw error;
    }
}
