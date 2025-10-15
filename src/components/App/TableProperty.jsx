import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import ActionDropdown from "../App/ActionsDropdown";

export default function TableProperty() {
    const [properties, setProperties] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [totalCount, setTotalCount] = useState(0);

    const fetchProperties = async () => {
        setLoading(true);
        setError(null);

        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;

        const { data, error, count } = await supabase
            .from("properties")
            .select("*", { count: "exact" })
            .range(from, to)
            .order("id", { ascending: false });

        if (error) {
            setError(error.message);
        } else {
            setProperties(data || []);
            setTotalCount(count || 0);
        }

        setLoading(false);
    };

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

            // Refresca la lista después de eliminar
            fetchProperties();
        } catch (err) {
            console.error(err);
            setError("Error al eliminar la propiedad");
        }
    };

    useEffect(() => {
        fetchProperties();
    }, [page, pageSize]); // Re-fetch cuando cambian página o tamaño

    const totalPages = Math.ceil(totalCount / pageSize);

    if (loading) return <p>Cargando propiedades...</p>;
    if (error) return <p className="text-red-500">Error: {error}</p>;

    return (
        <div className="w-full relative shadow-md sm:rounded-lg border border-slate-200">
            <table className="w-full text-sm text-left rtl:text-right text-slate-500">
                <thead className="text-xs text-slate-600 uppercase bg-[#fafafa]">
                    <tr>
                        <th className="px-6 py-3">Propiedad</th>
                        <th className="px-6 py-3">Tipo</th>
                        <th className="px-6 py-3">Slug</th>
                        <th className="px-6 py-3">Precio</th>
                        <th className="px-6 py-3">Acción</th>
                    </tr>
                </thead>
                <tbody>
                    {properties.length === 0 ? (
                        <tr>
                            <td colSpan="5" className="text-center py-4 text-slate-500">
                                No hay propiedades disponibles.
                            </td>
                        </tr>
                    ) : (
                        properties.map((property) => (
                            <tr
                                key={property.id}
                                className="odd:bg-gray-200 even:bg-gray-50 border-b border-gray-200"
                            >
                                <th className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap">
                                    {property.title}
                                </th>
                                <td className="px-6 py-4">{property.property_type}</td>
                                <td className="px-6 py-4">
                                    <a
                                        href={`/propiedad/${property.slug}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-1"
                                    >
                                        {property.slug}
                                        <span>
                                            <svg
                                                xmlns="http://www.w3.org/2000/svg"
                                                width="16"
                                                height="16"
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth="2"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                            >
                                                <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                                                <path d="M12 6h-6a2 2 0 0 0 -2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-6" />
                                                <path d="M11 13l9 -9" />
                                                <path d="M15 4h5v5" />
                                            </svg>
                                        </span>
                                    </a>
                                </td>
                                <td className="px-6 py-4">$ {property.price}</td>
                                <td className="px-6 py-4 flex items-center gap-2">
                                    <ActionDropdown
                                        name="Acciones"
                                        link={`propiedad/editar/${property.id}`}
                                        handleDelete={() => handleClickDelete(property.id)}
                                    />
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>

            {/* --- Paginación --- */}
            <div className="flex justify-between items-center gap-2 p-3 border-t border-slate-200 bg-[#fafafa]">
                <div className="flex gap-1 items-center">
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
                            className={`border border-slate-400 rounded px-2 py-1 text-xs ${
                                page === i + 1
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
        </div>
    );
}
