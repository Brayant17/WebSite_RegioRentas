import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function TableProperty() {
    const [properties, setProperties] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [totalCount, setTotalCount] = useState(0);

    // 🆕 Estado para el modal
    const [propertyToDelete, setPropertyToDelete] = useState(null);

    // 🚀 Cargar propiedades
    const fetchProperties = async () => {
        setLoading(true);
        setError(null);

        try {
            const {
                data: { user },
                error: userError,
            } = await supabase.auth.getUser();

            if (userError) throw userError;
            if (!user) throw new Error("Usuario no autenticado");

            const from = (page - 1) * pageSize;
            const to = from + pageSize - 1;

            const { data, error, count } = await supabase
                .from("properties")
                .select(
                    `
          *,
          property_images:property_images(url, order)
        `,
                    { count: "exact" }
                )
                .eq("user_id", user.id)
                .order("id", { ascending: false })
                .range(from, to);

            if (error) throw error;

            const propertiesWithImage = data.map((p) => ({
                ...p,
                image_url: p.property_images?.find((img) => img.order === 1)?.url || null,
            }));

            setProperties(propertiesWithImage);
            setTotalCount(count || 0);
        } catch (err) {
            console.error(err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    // 🗑️ Confirmar eliminación (llamada real)
    const handleClickDelete = async (idProperty) => {
        try {
            const session = await supabase.auth.getSession();
            const token = session.data.session?.access_token;

            const res = await fetch("/api/delete-property", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ propiedadId: idProperty }),
            });

            if (!res.ok) throw new Error("Error al eliminar la propiedad");

            // Refrescar lista
            fetchProperties();
            setPropertyToDelete(null); // cerrar modal
        } catch (err) {
            console.error(err);
            setError("Error al eliminar la propiedad");
        }
    };

    useEffect(() => {
        fetchProperties();
    }, [page, pageSize]);

    const totalPages = Math.ceil(totalCount / pageSize);

    return (
        <div className="w-full relative">
            {loading && <p className="text-center text-slate-500">Cargando propiedades...</p>}
            {error && <p className="text-red-500 text-center">Error: {error}</p>}

            {properties.length === 0 ? (
                <p className="text-center py-8 text-slate-500">No hay propiedades disponibles.</p>
            ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {properties.map((property) => (
                        <div
                            key={property.id}
                            className="border border-slate-200 rounded-lg bg-white shadow-sm hover:shadow-md transition-shadow duration-200 overflow-hidden flex flex-col"
                        >
                            {/* Imagen */}
                            <div className="relative w-full h-48 bg-slate-100 flex items-center justify-center">
                                {property.image_url ? (
                                    <img
                                        src={property.image_url}
                                        alt={property.title}
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <span className="text-slate-400 text-sm">Sin imagen</span>
                                )}
                                <div className="absolute top-2 right-2 bg-slate-900 text-white text-xs font-medium px-2 py-1 rounded">
                                    ${property.price}
                                </div>
                            </div>

                            {/* Contenido */}
                            <div className="p-4 flex flex-col flex-grow">
                                <div className="flex justify-between items-start mb-2">
                                    <h3 className="font-semibold text-slate-800 text-base line-clamp-2">
                                        {property.title}
                                    </h3>
                                    <span className="text-slate-500 text-xs shrink-0">
                                        {property.property_type}
                                    </span>
                                </div>

                                <div className="text-sm text-slate-600 mb-3 flex-grow">
                                    <p>
                                        <span className="font-medium">Slug:</span>{" "}
                                        <a
                                            href={`/propiedad/${property.slug}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-blue-600 hover:underline break-all"
                                        >
                                            {property.slug}
                                        </a>
                                    </p>
                                </div>

                                {/* Acciones */}
                                <div className="w-full flex gap-3 justify-between mt-auto pt-2 border-t border-slate-100">
                                    <a
                                        href={`publicaciones/editar/${property.id}`}
                                        className="flex-1 text-center text-white bg-neutral-800 hover:bg-neutral-900 transition-colors text-sm font-medium py-1.5 rounded"
                                    >
                                        Editar
                                    </a>
                                    <button
                                        onClick={() => setPropertyToDelete(property)} // 🆕 Abrir modal
                                        className="flex-1 text-center text-red-600 border border-red-500 hover:bg-red-50 transition-colors text-sm font-medium py-1.5 rounded cursor-pointer"
                                    >
                                        Eliminar
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* 📄 Paginación */}
            <div className="flex flex-col sm:flex-row justify-between items-center gap-3 mt-6 border-t border-slate-200 pt-4 bg-[#fafafa] p-3 rounded-b-lg">
                <div className="flex gap-1 items-center text-sm">
                    <span>Mostrar por página:</span>
                    <select
                        value={pageSize}
                        onChange={(e) => setPageSize(Number(e.target.value))}
                        className="border border-slate-300 px-1 py-0.5 rounded"
                    >
                        {[5, 10, 20, 50].map((size) => (
                            <option key={size} value={size}>
                                {size}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="flex items-center gap-1">
                    <button
                        disabled={page === 1}
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        className="border border-slate-400 rounded px-2 py-1 text-xs text-slate-600 bg-white disabled:opacity-50"
                    >
                        {"<"}
                    </button>

                    {[...Array(totalPages)].map((_, i) => (
                        <button
                            key={i + 1}
                            onClick={() => setPage(i + 1)}
                            className={`border border-slate-400 rounded px-2 py-1 text-xs ${page === i + 1
                                ? "bg-slate-200 text-slate-800 font-medium"
                                : "bg-white text-slate-600"
                                }`}
                        >
                            {i + 1}
                        </button>
                    ))}

                    <button
                        disabled={page === totalPages || totalPages === 0}
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        className="border border-slate-400 rounded px-2 py-1 text-xs text-slate-600 bg-white disabled:opacity-50"
                    >
                        {">"}
                    </button>
                </div>
            </div>

            {/* 🧩 Modal de confirmación */}
            {propertyToDelete && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg shadow-lg p-6 w-80 text-center">
                        <h2 className="text-lg font-semibold text-slate-800 mb-2">
                            ¿Eliminar propiedad?
                        </h2>
                        <p className="text-slate-600 text-sm mb-4">
                            Estás a punto de eliminar{" "}
                            <span className="font-medium">{propertyToDelete.title}</span>.
                            <br />
                            Esta acción no se puede deshacer.
                        </p>
                        <div className="flex gap-3 justify-center">
                            <button
                                onClick={() => setPropertyToDelete(null)}
                                className="px-4 py-1.5 rounded bg-slate-200 hover:bg-slate-300 text-slate-800 text-sm font-medium cursor-pointer"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={() => handleClickDelete(propertyToDelete.id)}
                                className="px-4 py-1.5 rounded bg-red-600 hover:bg-red-700 text-white text-sm font-medium cursor-pointer"
                            >
                                Eliminar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
