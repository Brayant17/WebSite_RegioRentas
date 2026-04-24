import { fetchPropertyBySlug, fetchSimilarProperty } from "../repositories/properties.repository"

export async function getPropertyBySlug(slug: string) {

    const { data, error } = await fetchPropertyBySlug(slug)

    if (error) {
        return null
    }

    return data
}

export async function getSimilarProperties(propertyId: string) {
    const { data, error } = await fetchSimilarProperty(propertyId);

    if (error) {
        return null
    }

    return data
}

//  id,
//       title,
//       description,
//       price,
//       bedrooms,
//       bathrooms,
//       area,
//       floors,
//       parking,
//       estado,
//       municipio,
//       colonia,
//       property_type,
//       services,
//       amenities,
//       property_images ( url, order ),
//       users ( full_name, whatsapp )