// Enums sugeridos para valores controlados
export const PROPERTY_TYPES = ["house", "apartment", "cabin", "land"];
export const OPERATIONS = ["rent", "sale"];
export const CONDITIONS = ["new", "good", "fair", "to_renovate"];
export const STATUS = ["available", "sold", "reserved", "rented"];
export const SERVICES = ["water", "electricity", "internet", "gas"];
export const AMENITIES = ["pool", "gym", "garden", "security"];

// Estado inicial para una nueva propiedad
export const initialPropertyData = {
  // Básico
  title: "",
  slug: "",
  description: "",

  // Tipo y operación
  property_type: "", // usar valores de PROPERTY_TYPES
  operation: "",     // usar valores de OPERATIONS

  // Características
  price: 0,
  area: 0,
  floors: 0,
  bedrooms: 0,
  bathrooms: 0,
  parking: 0,

  // Estado físico
  furnished: false,

  // Servicios y amenidades
  services: [],       // usar valores de SERVICES
  amenities: [],      // usar valores de AMENITIES

  // Ubicación
  estado: "",
  municipio: "",
  colonia: "",
  zona: "",

  // Multimedia
  video_url: "",
  plans: "",

  // Estado de publicación
  status: "Disponible", // usar valores de STATUS
  user_id: "",
  available_from: null,  // Date o null
  is_public: false
};
