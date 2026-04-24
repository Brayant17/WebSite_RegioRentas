export type Property = {
  id: string | null; // null para nuevas propiedades, string para propiedades existentes
  title: string;
  description: string;
  slug: string;

  price: number;
  operation: string; // "Venta", "Renta", etc.
  property_type: string; // "Terreno", "Casa", etc.
  status: string; // "Disponible", etc.

  area: number;
  bedrooms: number;
  bathrooms: number;
  parking: number;
  floors: number;
  year_built: number | null;

  furnished: boolean;

  amenities: string[];
  services: string[];

  estado: string;
  municipio: string;
  colonia: string;
  zona: string;

  address?: string; // opcional si luego lo agregas

  available_from?: string | null; // ISO date (YYYY-MM-DD)
  published_at: string | null; // ISO datetime

  is_public: boolean;
  user_id: string;

  plans?: string;
  video_url?: string;
};

export type images = {
    preview: string;
    filename: string;
    id?: string;
    isExisting?: boolean;
};