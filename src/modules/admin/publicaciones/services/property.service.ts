import { listProperties } from "../repositories/property.repository";

export async function fetchProperties(
    filters: any = {},
    page: number = 1,
    limit: number = 10
) {
    return await listProperties(filters, page, limit);
}