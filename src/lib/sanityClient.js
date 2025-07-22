import { createClient } from '@sanity/client'

export const client = createClient({
  projectId: import.meta.env.VITE_SANITY_PROJECT_ID, // <- cámbialo
  dataset: import.meta.env.VITE_SANITY_DATASET,      // o el que estés usando
  apiVersion: import.meta.env.VITE_SANITY_API_VERSION,   // puedes dejar esta versión
  useCdn: true,               // true para producción (rápido)
})