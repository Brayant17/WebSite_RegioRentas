import { fetchUserProperties } from "../repositories/property.repository";

export async function getUserProperties(userId: string, from: number = 0, to: number = 9) {
    try {
        const { data, count } = await fetchUserProperties({ userId, from, to });
        return {data: data, count: count, error: null};
    } catch (error) {
        console.error("Error fetching user properties:", error);
        return {data: null, count: null, error: error};
    }
}
