import type { APIRoute } from "astro";
import propiedades from "../../mock/propiedades"; // tu función con el array de datos

export const GET: APIRoute = async ({ url }) => {
  const start = Number(url.searchParams.get("start")) || 0;
  const limit = Number(url.searchParams.get("limit")) || 24;
  const type = String(url.searchParams.get("type")) || null;

  // Obtener todas las propiedades mock
  const allProps = propiedades();

  // Simular paginación
  const paginated = allProps.slice(start, start + limit);

  // Simular el filtrado por type
  const filter = paginated.filter(p => p.type == type);

  // Simular delay para ver el loading
  await new Promise((res) => setTimeout(res, 500));

  if (type !== "null") {
    return new Response(JSON.stringify(filter), {
      headers: { "Content-Type": "application/json" },
    });
  }
  return new Response(JSON.stringify(paginated), {
    headers: { "Content-Type": "application/json" },
  });
};


export function getPropiedad(id: any) {
  const allProps = propiedades();
  const propByID = allProps.filter(p => p.id == id)
  return propByID;
}