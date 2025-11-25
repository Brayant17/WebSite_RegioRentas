export type Property = {
    id: string;
    title: string;
    slug: string;
    property_type: string;
    price: number;
    status: "published" | "draft" | "archived";
    created_at: string;
};
