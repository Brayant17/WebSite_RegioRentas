import { createClient } from '@sanity/client'

export const client = createClient({
  projectId: import.meta.env.SANITY_PROJECT_ID, // <- cámbialo
  dataset: import.meta.env.SANITY_DATASET,      // o el que estés usando
  apiVersion: import.meta.env.SANITY_API_VERSION,   // puedes dejar esta versión
  useCdn: true,               // true para producción (rápido)
})