interface Property {
  id: string;
  title: string;
  description: string;
  price: number;
  estado: string;
  bedrooms: number;
  bathrooms: number;
  area: number;
  floors: number;
  parking: number;
  municipio: string;
  colonia: string;
  property_type: string;
  services: string[];
  amenities?: string[];
  property_images?: PropertyImage[];
  users?: {
    full_name: string,
    whatsapp: string
  }
}

interface PropertyImage {
  url: string;
}