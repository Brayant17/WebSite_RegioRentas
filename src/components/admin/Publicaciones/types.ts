export type Property = {
    id: string;
    id_owner: string;
    title: string;
    slug: string;
    property_type: string;
    price: number;
    status: "published" | "draft" | "archived";
    published_at: string;
};
