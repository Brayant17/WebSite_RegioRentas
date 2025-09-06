import { supabase } from "../../lib/supabaseClient"
import { useEffect, useState } from "react";
import ActionDropdown from "../App/ActionsDropdown";

export default function TableProperty() {

    const [properties, setProperties] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleClickDelete = async (idProperty) => {
        const session = await supabase.auth.getSession()
        const token = session.data.session?.access_token

        await fetch('/api/delete-property', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ propiedadId: idProperty }),
        })


    }

    useEffect(() => {
        const fetch = async () => {
            setLoading(true);
            const { data, error } = await supabase.from("properties").select();
            if (error) setError(error.message);
            else setProperties(data);
            setLoading(false)
        }

        fetch();
    }, [])

    useEffect(() => {
        console.log(properties);
    }, [properties])

    if (loading) return <p>Cargando propiedades...</p>
    if (error) return <p className="text-red-500">Error: {error}</p>

    return (

        <div className="w-full relative overflow-x-auto shadow-md sm:rounded-lg border border-slate-200">
            <table className="w-full text-sm text-left rtl:text-right text-slate-500">
                <thead className="text-xs text-slate-600 uppercase bg-[#fafafa]">
                    <tr>
                        <th scope="col" className="px-6 py-3">
                            Propiedad
                        </th>
                        <th scope="col" className="px-6 py-3">
                            Tipo
                        </th>
                        <th scope="col" className="px-6 py-3">
                            Slug
                        </th>
                        <th scope="col" className="px-6 py-3">
                            Precio
                        </th>
                        <th scope="col" className="px-6 py-3">
                            Action
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {properties && (
                        properties.map(property => (
                            <tr key={property.id} className="odd:bg-gray-200 even:bg-gray-50 border-b border-gray-200">
                                <th scope="row" className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap">
                                    {property.title}
                                </th>
                                <td className="px-6 py-4">
                                    {property.property_type}
                                </td>
                                <td className="px-6 py-4">
                                    <a href={"/propiedad/" + property.slug} target="_blank" className="flex items-center gap-1">
                                        {property.slug}
                                        <span>
                                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon icon-tabler icons-tabler-outline icon-tabler-external-link"><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path d="M12 6h-6a2 2 0 0 0 -2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-6" /><path d="M11 13l9 -9" /><path d="M15 4h5v5" /></svg>
                                        </span>
                                    </a>
                                </td>
                                <td className="px-6 py-4">
                                    $ {property.price}
                                </td>
                                <td className="px-6 py-4 flex items-center gap-2">
                                    <ActionDropdown name="Acciones" link={`propiedad/editar/${property.id}`} handleDelete={() => handleClickDelete(property.id)} />
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
            <div className="flex justify-between gap-2 p-3 border-t border-slate-200 bg-[#fafafa]">
                <div className="flex gap-1 items-center">
                    <span>Mostrando por página</span>
                    <select name="" id="" className="border border-slate-300 px-1 py-0.5 rounded">
                        <option value="">1</option>
                        <option value="">2</option>
                        <option value="">3</option>
                        <option value="">4</option>
                        <option value="">5</option>
                    </select>
                </div>
                <nav aria-label="Table pagination" className="flex flex-row gap-1 items-center">
                    <button className="border border-slate-400 rounded px-1.5 py-1 text-xs text-slate-600 cursor-pointer bg-white">{"<"}</button>
                    <button className="border border-slate-400 rounded px-1.5 py-1 text-xs text-slate-600 cursor-pointer bg-white">1</button>
                    <button className="border border-slate-400 rounded px-1.5 py-1 text-xs text-slate-600 cursor-pointer bg-white">2</button>
                    <button className="border border-slate-400 rounded px-1.5 py-1 text-xs text-slate-600 cursor-pointer bg-white">3</button>
                    <button className="border border-slate-400 rounded px-1.5 py-1 text-xs text-slate-600 cursor-pointer bg-white">{">"}</button>
                </nav>
            </div>
        </div>
    )
}