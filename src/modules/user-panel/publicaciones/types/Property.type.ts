export type Property = {
    id: string;
    title: string;
    description: string;
    price: number;
    estado: string;
    bedrooms: number;
    bathrooms: number;
    floors: number;
    furnished: boolean;
    is_public: boolean;
    municipio: string;
    operation: string;
    parking: number;
    plans: string;
    property_images: PropertyImage[];
    property_type: string;
    published_at: string;
    services: string[];
    slug: string;
    status: string;
    user_id: string;
    video_url: string;
    year_built: number | null;
    zona: string;

}

export type PropertyImage = {
    order: number;
    url: string;
}