export type Property = {
    id: string;
    title: string;
    description: string;
    price: number;
    municipio: string;
    colonia: string;
    slug: string;
    property_type: string;
    operation: string;
    property_images: { url: string }[];
    bedrooms?: number;
    bathrooms?: number;
    area?: number;
    users?: {
        name?: string;
        is_verified?: boolean;
        whatsapp?: string;
    };
}