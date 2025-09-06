import type { APIRoute } from "astro";

export const POST: APIRoute = async ({ request }) => {

    const formData = await request.formData();

    const files = formData.getAll('files') as File[];

    if(files.length === 0){
        return new Response(
            JSON.stringify({error: "No se enviaron archivos"}),
            { status: 400, headers: { "Content-Type": "application/json" } }
        );
    }

    // Procesar cada archivo
    files.forEach(element => {
        console.log(element);
    });

    return new Response(JSON.stringify({ succes: true }), {
        status: 200,
        headers: { "ContentType": "application/json" },
    });
}
