export type DetailType =
    | "building"
    | "bedrooms"
    | "bathrooms"
    | "parking"
    | "area"
    | "floors"
    | "Internet"
    | "Agua"
    | "Luz"
    | "Gas"
    | "pet_friendly";

export type Detail = {
    type: DetailType;
    value: string | number;
    label: string;
};