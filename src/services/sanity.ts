import { client } from "../lib/sanityClient";
// 👇 Esta función le dice a Astro qué slugs existen

export async function getSlugs(){
  const propiedades = await client.fetch(
    `*[_type == "property"]{ "slug": slug.current }`,
  );
  return propiedades
}
// export async function getStaticPaths() {
//   return propiedades.map((prop: any) => ({
//     params: { slug: prop.slug },
//   }));